import cors from 'cors'
import express from 'express'
import { HttpError } from './errors.js'
import { createAdminRouter } from './routes/admin.js'
import { createMenusRouter } from './routes/menus.js'
import { createOrdersRouter } from './routes/orders.js'

export function createApp(pool, { clientOrigin = 'http://localhost:5173' } = {}) {
  const app = express()

  app.use(cors({ origin: clientOrigin.split(',').map((origin) => origin.trim()) }))
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/health', async (_request, response) => {
    await pool.query('SELECT 1')
    response.json({ status: 'ok' })
  })

  app.use('/api/menus', createMenusRouter(pool))
  app.use('/api/admin', createAdminRouter(pool))
  app.use('/api/orders', createOrdersRouter(pool))

  app.use((_request, _response, next) => {
    next(new HttpError(404, 'ROUTE_NOT_FOUND', '요청한 API를 찾을 수 없습니다.'))
  })

  app.use((error, _request, response, _next) => {
    if (error instanceof HttpError) {
      return response.status(error.status).json({
        error: { code: error.code, message: error.message },
      })
    }

    if (error?.type === 'entity.parse.failed') {
      return response.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'JSON 요청 본문 형식이 올바르지 않습니다.',
        },
      })
    }

    console.error('처리되지 않은 API 오류입니다.', error)
    return response.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '서버 내부 오류가 발생했습니다.',
      },
    })
  })

  return app
}
