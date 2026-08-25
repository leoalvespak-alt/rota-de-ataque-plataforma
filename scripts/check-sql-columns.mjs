/**
 * SQL column validation gate.
 *
 * Reads every migration in packages/db/migrations/*.up.sql (in order),
 * applies them to a temporary schema in the target database, then walks
 * apps/web/src and workers/<worker>/src looking for SQL string literals.
 * Each literal is compiled with PREPARE; any 42703 (undefined_column) or
 * 42P01 (undefined_table) causes the script to exit non-zero.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/check-sql-columns.mjs
 *
 * In CI add a postgres service and set DATABASE_URL.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Bootstrap — load pg without requiring a compiled workspace
// ---------------------------------------------------------------------------
const require = createRequire(import.meta.url)
let pg
try {
  pg = createRequire(path.join(path.resolve(import.meta.dirname, '..'), 'packages', 'db', 'package.json'))('pg')
} catch {
  pg = require('pg')
}
const { Pool } = pg

const root = path.resolve(import.meta.dirname, '..')
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is not set. Point it at a disposable test database.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sortedMigrations() {
  const dir = path.join(root, 'packages', 'db', 'migrations')
  return readdirSync(dir)
    .filter(f => f.endsWith('.up.sql'))
    .sort()
    .map(f => ({ name: f, sql: readFileSync(path.join(dir, f), 'utf8') }))
}

/**
 * Extract SQL string literals from TypeScript/JavaScript source files.
 * Looks for template literals that follow pool.query`...` or pool.query(`, client.query(`, etc.
 */
function extractSqlLiterals(sourceRoot) {
  const files = []
  function walk(dir) {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') walk(full)
      else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) files.push(full)
    }
  }
  walk(sourceRoot)

  const literals = []
  const patterns = [
    // template literal: pool.query(`...`)
    /(?:pool|client|db)\.query\s*\(\s*`([^`]+)`/gs,
    // double-quoted string (common in SQL builders)
    /(?:pool|client|db)\.query\s*\(\s*"((?:[^"\\]|\\.)*)"/gs,
    // single-quoted string (common in compact route handlers)
    /(?:pool|client|db)\.query\s*\(\s*'((?:[^'\\]|\\.)*)'/gs,
  ]
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (const pattern of patterns) {
      let match
      const re = new RegExp(pattern.source, pattern.flags)
      while ((match = re.exec(source)) !== null) {
        const sql = match[1]
          .replace(/\$\{[^}]+\}/g, '$1') // replace template expressions with placeholder
          .trim()
        if (sql.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\s/i)) {
          literals.push({ file: path.relative(root, file), sql })
        }
      }
    }
  }
  return literals
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const pool = new Pool({ connectionString: databaseUrl, max: 1 })
const client = await pool.connect()
let exitCode = 0

try {
  const schema = `_sqlcheck_${Date.now()}`
  await client.query(`CREATE SCHEMA "${schema}"`)
  await client.query(`SET search_path TO "${schema}", public`)

  console.log('Applying migrations...')
  for (const { name, sql } of sortedMigrations()) {
    try {
      await client.query(sql)
      process.stdout.write('.')
    } catch (err) {
      throw new Error(`Migration ${name} failed in disposable SQL gate: ${err.message.split('\n')[0]}`, { cause: err })
    }
  }
  console.log('\nMigrations applied.')

  const sourceDirs = [
    path.join(root, 'apps', 'web', 'src'),
    path.join(root, 'workers'),
  ]

  const allLiterals = sourceDirs.flatMap(extractSqlLiterals)
  console.log(`Validating ${allLiterals.length} SQL literals...`)

  let stmtId = 0
  for (const { file, sql } of allLiterals) {
    // Replace positional params with $1..$N placeholders (already present) and strip JS template expressions
    const cleanSql = sql.replace(/\$\{[^}]+\}/g, '?').replace(/\?/g, '$1')
    try {
      await client.query(`PREPARE _check_${++stmtId} AS ${cleanSql}`)
      await client.query(`DEALLOCATE _check_${stmtId}`)
    } catch (err) {
      if (err.code === '42703' || err.code === '42P01') {
        console.error(`\nFAIL [${err.code}] ${file}\n  ${err.message.split('\n')[0]}`)
        exitCode = 1
      }
      // Ignore other prepare errors (e.g. type mismatches from param stripping)
    }
  }

  await client.query(`DROP SCHEMA "${schema}" CASCADE`)
} finally {
  client.release()
  await pool.end()
}

if (exitCode === 0) {
  console.log('\nAll SQL literals validated successfully.')
} else {
  console.error('\nSQL column validation FAILED. Fix the errors above before deploying.')
}
process.exit(exitCode)
