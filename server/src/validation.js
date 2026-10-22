import { z } from 'zod'
import { HttpError } from './errors.js'

const orderItemSchema = z.object({
  menuId: z.uuid(),
  quantity: z.number().int().min(1).max(2147483647),
  optionIds: z
    .array(z.uuid())
    .refine((ids) => new Set(ids).size === ids.length),
})

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
})

export const stockAdjustmentSchema = z.object({
  adjustment: z.union([z.literal(1), z.literal(-1)]),
})

export const orderStatusSchema = z.object({
  status: z.enum(['preparing', 'completed']),
})

export function parseRequest(schema, input) {
  const result = schema.safeParse(input)

  if (!result.success) {
    throw new HttpError(400, 'INVALID_REQUEST', '요청 데이터 형식이 올바르지 않습니다.')
  }

  return result.data
}
