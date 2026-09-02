import pg from 'pg'

const { Pool } = pg
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : new Pool()

function decode(value) {
  try { return decodeURIComponent(value) } catch { return value }
}

function validProject(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 64
}

function validTable(value) {
  return /^[a-z][a-z0-9_]{0,62}$/.test(value)
}

export async function guardLegacyScopeData(req, res) {
  const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname
  const match = pathname.match(/^\/v1\/data\/([^/]+)\/([^/]+)(?:\/[^/]+)?$/)
  if (!match) return false
  const project = decode(match[1])
  const table = decode(match[2])
  if (!validProject(project) || !validTable(table)) return false

  const result = await pool.query(
    'SELECT mode FROM iz_core_table_policies WHERE project_id=$1 AND table_name=$2',
    [project, table],
  )
  if (result.rows[0]?.mode !== 'scope') return false

  res.writeHead(409, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify({
    error: 'Scoped table access requires the IZAKHONO Core /v2 policy API',
    code: 'IZAKHONO_SCOPE_POLICY_V2_REQUIRED',
  }))
  return true
}
