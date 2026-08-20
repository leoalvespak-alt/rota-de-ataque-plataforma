import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { brandProfiles } from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

const client = postgres(connectionString, { max: 1 })
const db = drizzle(client)

async function seed() {
  await db
    .insert(brandProfiles)
    .values({
      name: 'Rota de Ataque',
      handle: '@rotadeataque',
      slug: 'rotadeataque',
      isDefault: true,
      colorBackground: '#0A0A0A',
      colorText: '#F0F0F0',
      colorPrimary: '#C1121F',
      colorButton: '#C1121F',
      fontHeading: 'Rajdhani',
      fontBody: 'IBM Plex Sans',
    })
    .onConflictDoNothing({ target: brandProfiles.slug })

  console.log('✓ Default profile seeded.')
  await client.end()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
