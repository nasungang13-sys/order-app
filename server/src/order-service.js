import { HttpError } from './errors.js'
import { findOrder } from './order-repository.js'

export async function createOrder(pool, request) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const requestedMenuIds = [...new Set(request.items.map((item) => item.menuId))]
    const { rows: menuRows } = await client.query(
      `SELECT id, name, price, stock_quantity
       FROM menus
       WHERE id = ANY($1::uuid[])
       ORDER BY id
       FOR UPDATE`,
      [requestedMenuIds],
    )
    const menusById = new Map(menuRows.map((menu) => [menu.id, menu]))

    for (const menuId of requestedMenuIds) {
      if (!menusById.has(menuId)) {
        throw new HttpError(404, 'MENU_NOT_FOUND', '주문 메뉴를 찾을 수 없습니다.')
      }
    }

    const requestedOptionIds = [
      ...new Set(request.items.flatMap((item) => item.optionIds)),
    ]
    const { rows: optionRows } =
      requestedOptionIds.length === 0
        ? { rows: [] }
        : await client.query(
            `SELECT id, menu_id, name, price
             FROM options
             WHERE id = ANY($1::uuid[])`,
            [requestedOptionIds],
          )
    const optionsById = new Map(optionRows.map((option) => [option.id, option]))

    const itemData = request.items.map((item) => {
      const menu = menusById.get(item.menuId)
      const options = item.optionIds.map((optionId) => {
        const option = optionsById.get(optionId)

        if (!option || option.menu_id !== item.menuId) {
          throw new HttpError(
            400,
            'INVALID_OPTION',
            '선택한 옵션이 해당 메뉴에 속하지 않습니다.',
          )
        }

        return option
      })

      const unitPrice =
        menu.price + options.reduce((sum, option) => sum + option.price, 0)
      const lineAmount = unitPrice * item.quantity

      if (
        !Number.isSafeInteger(unitPrice) ||
        unitPrice > 2147483647 ||
        !Number.isSafeInteger(lineAmount) ||
        lineAmount > 2147483647
      ) {
        throw new HttpError(
          400,
          'ORDER_AMOUNT_OUT_OF_RANGE',
          '주문 금액이 허용 범위를 초과했습니다.',
        )
      }

      return {
        ...item,
        menu,
        options,
        unitPrice,
        lineAmount,
      }
    })

    const quantityByMenuId = new Map()
    for (const item of itemData) {
      quantityByMenuId.set(
        item.menuId,
        (quantityByMenuId.get(item.menuId) ?? 0) + item.quantity,
      )
    }

    for (const [menuId, quantity] of quantityByMenuId) {
      if (menusById.get(menuId).stock_quantity < quantity) {
        throw new HttpError(
          409,
          'INSUFFICIENT_STOCK',
          `${menusById.get(menuId).name} 재고가 부족합니다.`,
        )
      }
    }

    const totalAmount = itemData.reduce((sum, item) => sum + item.lineAmount, 0)
    if (!Number.isSafeInteger(totalAmount) || totalAmount > 2147483647) {
      throw new HttpError(
        400,
        'ORDER_AMOUNT_OUT_OF_RANGE',
        '주문 금액이 허용 범위를 초과했습니다.',
      )
    }
    const { rows: createdOrders } = await client.query(
      `INSERT INTO orders (status, total_amount)
       VALUES ('received', $1)
       RETURNING id`,
      [totalAmount],
    )
    const orderId = createdOrders[0].id

    for (const item of itemData) {
      const { rows: createdItems } = await client.query(
        `INSERT INTO order_items
           (order_id, menu_id, menu_name, menu_price, quantity, unit_price, line_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          orderId,
          item.menuId,
          item.menu.name,
          item.menu.price,
          item.quantity,
          item.unitPrice,
          item.lineAmount,
        ],
      )

      for (const option of item.options) {
        await client.query(
          `INSERT INTO order_item_options
             (order_item_id, option_id, option_name, option_price)
           VALUES ($1, $2, $3, $4)`,
          [createdItems[0].id, option.id, option.name, option.price],
        )
      }
    }

    for (const [menuId, quantity] of quantityByMenuId) {
      await client.query(
        `UPDATE menus
         SET stock_quantity = stock_quantity - $2, updated_at = NOW()
         WHERE id = $1 AND stock_quantity >= $2`,
        [menuId, quantity],
      )
    }

    const order = await findOrder(client, orderId)
    await client.query('COMMIT')
    return order
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      console.error('주문 트랜잭션 롤백에 실패했습니다.', rollbackError)
    }
    throw error
  } finally {
    client.release()
  }
}
