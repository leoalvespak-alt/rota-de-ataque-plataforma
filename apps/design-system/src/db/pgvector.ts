import { customType } from 'drizzle-orm/pg-core'

/** PostgreSQL pgvector column with a typed number-array boundary. */
export const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverParam: string }>({
    dataType: () => `vector(${dimensions})`,
    toDriver: (value: number[]) => `[${value.join(',')}]`,
    fromDriver: (value: unknown) => String(value).replace(/\[|\]/g, '').split(',').filter(Boolean).map(Number),
  })(name)
