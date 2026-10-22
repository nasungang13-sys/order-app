import { z } from 'zod'

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

export function requireUuid(value, fieldName = 'id') {
  const result = z.uuid().safeParse(value)

  if (!result.success) {
    throw new HttpError(400, 'INVALID_ID', `${fieldName}는 유효한 UUID여야 합니다.`)
  }

  return result.data
}
