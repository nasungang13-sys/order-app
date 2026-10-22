import 'dotenv/config'
import pg from 'pg'
import { createApp } from './app.js'

const { Pool } = pg
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : undefined,
)
const port = Number(process.env.PORT ?? 3000)
const app = createApp(pool, {
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
})

try {
  await pool.query('SELECT 1')
  const server = app.listen(port, () => {
    console.info(`COZY API 서버가 http://localhost:${port} 에서 실행 중입니다.`)
  })

  server.on('error', (error) => {
    console.error('API 서버를 시작하지 못했습니다.', error)
    process.exitCode = 1
  })

  async function shutdown(signal) {
    console.info(`${signal} 신호를 받아 서버를 종료합니다.`)
    server.close(async (error) => {
      if (error) {
        console.error('HTTP 서버를 종료하지 못했습니다.', error)
        process.exitCode = 1
      }

      try {
        await pool.end()
      } catch (poolError) {
        console.error('데이터베이스 연결을 종료하지 못했습니다.', poolError)
        process.exitCode = 1
      }
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
} catch (error) {
  console.error('PostgreSQL에 연결할 수 없어 API 서버를 시작하지 못했습니다.', error)
  try {
    await pool.end()
  } catch (poolError) {
    console.error('데이터베이스 연결을 종료하지 못했습니다.', poolError)
  }
  process.exitCode = 1
}
