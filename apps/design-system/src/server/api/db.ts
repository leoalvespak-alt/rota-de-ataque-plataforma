import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@/db/schema'

const connectionString = process.env.DATABASE_URL ?? 'postgresql://rota:rota_dev_password@localhost:5432/rota_design'
const pool = new Pool({ connectionString })
const prospectorConnectionString = process.env.PROSPECTOR_DATABASE_URL
const prospectorPool = prospectorConnectionString ? new Pool({ connectionString: prospectorConnectionString }) : null
export const db = drizzle({ client: pool, schema })
export { pool, prospectorPool }
