import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as designSchema from '@/db/schema'
import * as editorialSchema from '@/db/editorial-schema'

const connectionString = process.env.DATABASE_URL ?? 'postgresql://rota:rota_dev_password@localhost:5432/rota_design'
const pool = new Pool({ connectionString })
export const db = drizzle({ client: pool, schema: { ...designSchema, ...editorialSchema } })
export { pool }
