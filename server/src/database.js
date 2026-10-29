import pg from 'pg'

const { Pool } = pg

export function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL })
  }

  const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  }
  const hasConfig = Object.values(config).some((value) => value !== undefined)

  return new Pool(hasConfig ? config : undefined)
}