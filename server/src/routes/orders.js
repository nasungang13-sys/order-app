import { Router } from 'express'
import { requireUuid } from '../errors.js'
import { findOrder } from '../order-repository.js'
import { createOrder } from '../order-service.js'
import { createOrderSchema, parseRequest } from '../validation.js'

export function createOrdersRouter(pool) {
  const router = Router()

  router.post('/', async (request, response) => {
    const orderRequest = parseRequest(createOrderSchema, request.body)
    const order = await createOrder(pool, orderRequest)
    response.status(201).json(order)
  })

  router.get('/:orderId', async (request, response) => {
    const orderId = requireUuid(request.params.orderId, 'orderId')
    response.json(await findOrder(pool, orderId))
  })

  return router
}
