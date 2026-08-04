import pg from 'pg'
import { config } from './config'

const { Pool } = pg

export const db = new Pool({
  connectionString: config.databaseUrl,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.DATABASE_SSL === 'disable'
    ? false
    : { rejectUnauthorized: false },
})

db.on('error', (error) => {
  console.error('Unexpected Postgres pool error', error)
})
