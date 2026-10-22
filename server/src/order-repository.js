import { HttpError } from './errors.js'

export async function findOrders(queryable, orderIds) {
  if (orderIds.length === 0) {
    return []
  }

  const { rows: orderRows } = await queryable.query(
    `SELECT id, ordered_at, status, total_amount
     FROM orders
     WHERE id = ANY($1::uuid[])
     ORDER BY ordered_at DESC, id`,
    [orderIds],
  )

  if (orderRows.length === 0) {
    return []
  }

  const returnedOrderIds = orderRows.map((order) => order.id)
  const { rows: itemRows } = await queryable.query(
    `SELECT id, order_id, menu_id, menu_name, quantity, unit_price, line_amount
     FROM order_items
     WHERE order_id = ANY($1::uuid[])
     ORDER BY id`,
    [returnedOrderIds],
  )
  const itemIds = itemRows.map((item) => item.id)
  const { rows: optionRows } =
    itemIds.length === 0
      ? { rows: [] }
      : await queryable.query(
          `SELECT order_item_id, option_id, option_name, option_price
           FROM order_item_options
           WHERE order_item_id = ANY($1::uuid[])
           ORDER BY id`,
          [itemIds],
        )

  const optionsByItemId = new Map()
  for (const option of optionRows) {
    const options = optionsByItemId.get(option.order_item_id) ?? []
    options.push({
      optionId: option.option_id,
      name: option.option_name,
      price: option.option_price,
    })
    optionsByItemId.set(option.order_item_id, options)
  }

  const itemsByOrderId = new Map()
  for (const item of itemRows) {
    const items = itemsByOrderId.get(item.order_id) ?? []
    items.push({
      menuId: item.menu_id,
      menuName: item.menu_name,
      quantity: item.quantity,
      options: optionsByItemId.get(item.id) ?? [],
      unitPrice: item.unit_price,
      lineAmount: item.line_amount,
    })
    itemsByOrderId.set(item.order_id, items)
  }

  return orderRows.map((order) => ({
    id: order.id,
    orderedAt: order.ordered_at.toISOString(),
    status: order.status,
    totalAmount: order.total_amount,
    items: itemsByOrderId.get(order.id) ?? [],
  }))
}

export async function findOrder(queryable, orderId) {
  const orders = await findOrders(queryable, [orderId])

  if (orders.length === 0) {
    throw new HttpError(404, 'ORDER_NOT_FOUND', '주문을 찾을 수 없습니다.')
  }

  return orders[0]
}
