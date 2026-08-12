import { pgTable, text, timestamp, uuid, jsonb, integer, boolean, varchar, numeric } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  tokens: jsonb('tokens').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const brandTokens = pgTable('brand_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id').references(() => brands.id).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  key: varchar('key', { length: 255 }).notNull(),
  value: text('value').notNull(),
  version: integer('version').default(1),
})

export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: varchar('template_id', { length: 100 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  format: varchar('format', { length: 50 }).notNull(),
  filter: varchar('filter', { length: 50 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const templateVersions = pgTable('template_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').references(() => templates.id).notNull(),
  version: integer('version').notNull(),
  definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const creatives = pgTable('creatives', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  brandId: uuid('brand_id').references(() => brands.id),
  templateId: varchar('template_id', { length: 100 }).notNull(),
  title: varchar('title', { length: 500 }),
  elements: jsonb('elements').$type<Record<string, unknown>>().notNull(),
  dark: boolean('dark').default(false),
  status: varchar('status', { length: 50 }).default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const creativeVersions = pgTable('creative_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  creativeId: uuid('creative_id').references(() => creatives.id).notNull(),
  version: integer('version').notNull(),
  elements: jsonb('elements').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const decks = pgTable('decks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  title: varchar('title', { length: 500 }).notNull(),
  dark: boolean('dark').default(true),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const slides = pgTable('slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id').references(() => decks.id).notNull(),
  position: integer('position').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  notes: text('notes'),
})

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  dark: boolean('dark').default(false),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const documentPages = pgTable('document_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id).notNull(),
  position: integer('position').notNull(),
  blocks: jsonb('blocks').$type<Array<Record<string, unknown>>>().notNull(),
})

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  filename: varchar('filename', { length: 500 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: integer('size').notNull(),
  storageKey: varchar('storage_key', { length: 1000 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const assetVariants = pgTable('asset_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').references(() => assets.id).notNull(),
  variant: varchar('variant', { length: 100 }).notNull(),
  storageKey: varchar('storage_key', { length: 1000 }).notNull(),
  width: integer('width'),
  height: integer('height'),
})

export const renders = pgTable('renders', {
  id: uuid('id').primaryKey().defaultRandom(),
  creativeId: uuid('creative_id').references(() => creatives.id),
  format: varchar('format', { length: 20 }).notNull(),
  storageKey: varchar('storage_key', { length: 1000 }).notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  size: integer('size'),
  duration: integer('duration'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const exports = pgTable('exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  format: varchar('format', { length: 20 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending'),
  storageKey: varchar('storage_key', { length: 1000 }),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

export const aiProviders = pgTable('ai_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  baseUrl: varchar('base_url', { length: 1000 }),
  model: varchar('model', { length: 255 }),
  active: boolean('active').default(true),
})

export const aiGenerations = pgTable('ai_generations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  providerId: uuid('provider_id').references(() => aiProviders.id),
  type: varchar('type', { length: 50 }).notNull(),
  prompt: text('prompt').notNull(),
  result: jsonb('result').$type<Record<string, unknown>>(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  duration: integer('duration'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  key: varchar('key', { length: 255 }).notNull(),
  value: jsonb('value').$type<unknown>(),
})

export type CreativeProjectStatus = 'nao_iniciado' | 'em_andamento' | 'finalizado'

export const creativeProjects = pgTable('creative_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  brandId: uuid('brand_id').references(() => brands.id),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 30 }).notNull().default('nao_iniciado').$type<CreativeProjectStatus>(),
  format: varchar('format', { length: 50 }),
  templateId: varchar('template_id', { length: 100 }),
  cardCount: integer('card_count').default(1),
  wizardStep: integer('wizard_step').default(1),
  wizardData: jsonb('wizard_data').$type<Record<string, unknown>>(),
  elements: jsonb('elements').$type<Record<string, unknown>>(),
  slides: jsonb('slides').$type<Array<Record<string, unknown>>>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  profileId: uuid('profile_id').references(() => brandProfiles.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

export const aiTokenLogs = pgTable('ai_token_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  model: varchar('model', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 100 }).notNull(),
  operation: varchar('operation', { length: 100 }).notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  costUsd: numeric('cost_usd', { precision: 12, scale: 8 }).notNull().default('0'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 255 }).notNull(),
  entity: varchar('entity', { length: 100 }),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const brandProfiles = pgTable('brand_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  handle: varchar('handle', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  isDefault: boolean('is_default').default(false).notNull(),

  colorBackground: varchar('color_background', { length: 9 }).notNull(),
  colorText: varchar('color_text', { length: 9 }).notNull(),
  colorPrimary: varchar('color_primary', { length: 9 }).notNull(),
  colorButton: varchar('color_button', { length: 9 }).notNull(),

  fontHeading: varchar('font_heading', { length: 255 }).notNull().default('Rajdhani'),
  fontBody: varchar('font_body', { length: 255 }).notNull().default('IBM Plex Sans'),

  avatarKey: varchar('avatar_key', { length: 1000 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type BrandProfile = typeof brandProfiles.$inferSelect
export type NewBrandProfile = typeof brandProfiles.$inferInsert

export * from './editorial-schema'
