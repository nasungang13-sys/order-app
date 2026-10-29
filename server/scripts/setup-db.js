import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { createPool } from '../src/database.js'

const pool = createPool()
try {
  const schema = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8')
  const seed = await readFile(new URL('../sql/seed.sql', import.meta.url), 'utf8')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(schema)
    await client.query(seed)
    await client.query('COMMIT')
    console.info('데이터베이스 스키마와 초기 메뉴 데이터를 준비했습니다.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
} catch (error) {
  console.error('데이터베이스 초기화에 실패했습니다.', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
