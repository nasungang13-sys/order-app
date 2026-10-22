import { Router } from 'express'
import { HttpError, requireUuid } from '../errors.js'
import { findOrders } from '../order-repository.js'
import { orderStatusSchema, parseRequest, stockAdjustmentSchema } from '../validation.js'
import { createMenusRouter } from './menus.js'

export function createAdminRouter(pool) {
  const router = Router()

  router.use('/menus', createMenusRouter(pool, { includeStock: true }))

  router.patch('/menus/:menuId/stock', async (request, response) => {
    const menuId = requireUuid(request.params.menuId, 'menuId')
    const { adjustment } = parseRequest(stockAdjustmentSchema, request.body)
    const { rows } = await pool.query(
      `UPDATE menus
       SET stock_quantity = stock_quantity + $2, updated_at = NOW()
       WHERE id = $1 AND stock_quantity + $2 >= 0
       RETURNING id, stock_quantity`,
      [menuId, adjustment],
    )

    if (rows.length === 0) {
      const existingMenu = await pool.query(
        'SELECT id FROM menus WHERE id = $1',
        [menuId],
      )

      if (existingMenu.rows.length === 0) {
        throw new HttpError(404, 'MENU_NOT_FOUND', '메뉴를 찾을 수 없습니다.')
      }

      throw new HttpError(
        409,
        'INSUFFICIENT_STOCK',
        '재고 수량은 0개 미만으로 변경할 수 없습니다.',
      )
    }

    response.json({
      id: rows[0].id,
      stockQuantity: rows[0].stock_quantity,
    })
  })

  router.get('/orders', async (_request, response) => {
    const { rows } = await pool.query(
      'SELECT id FROM orders ORDER BY ordered_at DESC, id',
    )
    response.json({ items: await findOrders(pool, rows.map((row) => row.id)) })
  })

  router.patch('/orders/:orderId/status', async (request, response) => {
    const orderId = requireUuid(request.params.orderId, 'orderId')
    const { status } = parseRequest(orderStatusSchema, request.body)
    const expectedStatus = status === 'preparing' ? 'received' : 'preparing'
    const { rows } = await pool.query(
      `UPDATE orders
       SET status = $2, updated_at = NOW()
       WHERE id = $1 AND status = $3
       RETURNING id, status, updated_at`,
      [orderId, status, expectedStatus],
    )

    if (rows.length === 0) {
      const existingOrder = await pool.query(
        'SELECT status FROM orders WHERE id = $1',
        [orderId],
      )

      if (existingOrder.rows.length === 0) {
        throw new HttpError(404, 'ORDER_NOT_FOUND', '주문을 찾을 수 없습니다.')
      }

      throw new HttpError(
        409,
        'INVALID_STATUS_TRANSITION',
        '현재 주문 상태에서 요청한 상태로 변경할 수 없습니다.',
      )
    }

    response.json({
      id: rows[0].id,
      status: rows[0].status,
      updatedAt: rows[0].updated_at.toISOString(),
    })
  })

  return router
}
