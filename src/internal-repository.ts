type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
};

type D1Database = { prepare(query: string): D1PreparedStatement };

type InternalRepoEnv = { DB: D1Database };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS builder_internal_repositories (
    project_id TEXT PRIMARY KEY REFERENCES builder_projects(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
    head_commit_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS builder_internal_repo_commits (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES builder_projects(id) ON DELETE CASCADE,
    parent_commit_id TEXT REFERENCES builder_internal_repo_commits(id),
    revision TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    message TEXT NOT NULL,
    files_json TEXT NOT NULL,
    file_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, content_hash)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_builder_internal_repo_commits_project
    ON builder_internal_repo_commits(project_id, created_at DESC)`,
];

export async function ensureInternalRepositorySchema(env: InternalRepoEnv): Promise<void> {
  for (const sql of SCHEMA) await env.DB.prepare(sql).run();
}

function canonicalFiles(files: Record<string, unknown>): string {
  const ordered: Record<string, string> = {};
  for (const path of Object.keys(files || {}).sort()) ordered[path] = String(files[path]);
  return JSON.stringify(ordered);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function publicCommit(row: any) {
  return {
    id: row.id,
    parent_commit_id: row.parent_commit_id || null,
    revision: row.revision,
    content_hash: row.content_hash,
    message: row.message,
    file_count: Number(row.file_count || 0),
    created_at: row.created_at,
  };
}

export async function commitInternalRepository(env: InternalRepoEnv, project: any, generated: any): Promise<any> {
  if (!project?.id || !project?.slug) throw new Error('Internal repository requires a project identity.');
  if (!generated?.validation?.passed || !generated?.files) throw new Error('Internal repository accepts only validated generated bundles.');
  await ensureInternalRepositorySchema(env);

  const filesJson = canonicalFiles(generated.files);
  const hash = await sha256Hex(filesJson);
  const commitId = `izc_${hash.slice(0, 24)}`;
  const revision = String(generated.revision || hash.slice(0, 12));

  await env.DB.prepare(`INSERT OR IGNORE INTO builder_internal_repositories(project_id,slug,visibility)
    VALUES(?,?,'private')`).bind(project.id, project.slug).run();

  const existing = await env.DB.prepare(`SELECT id,parent_commit_id,revision,content_hash,message,file_count,created_at
    FROM builder_internal_repo_commits WHERE project_id=? AND content_hash=?`).bind(project.id, hash).first<any>();

  if (existing) {
    await env.DB.prepare(`UPDATE builder_internal_repositories SET head_commit_id=?,updated_at=CURRENT_TIMESTAMP WHERE project_id=?`)
      .bind(existing.id, project.id).run();
    return {
      provider: 'izakhono-internal',
      slug: project.slug,
      visibility: 'private',
      head_commit_id: existing.id,
      commit: publicCommit(existing),
      reused_existing_snapshot: true,
    };
  }

  const repo = await env.DB.prepare('SELECT head_commit_id FROM builder_internal_repositories WHERE project_id=?')
    .bind(project.id).first<any>();
  const parent = repo?.head_commit_id || null;
  const message = `Validated generated bundle ${revision}`;

  await env.DB.prepare(`INSERT INTO builder_internal_repo_commits
    (id,project_id,parent_commit_id,revision,content_hash,message,files_json,file_count)
    VALUES(?,?,?,?,?,?,?,?)`)
    .bind(commitId, project.id, parent, revision, hash, message, filesJson, Object.keys(generated.files).length).run();
  await env.DB.prepare(`UPDATE builder_internal_repositories SET head_commit_id=?,updated_at=CURRENT_TIMESTAMP WHERE project_id=?`)
    .bind(commitId, project.id).run();

  const row = await env.DB.prepare(`SELECT id,parent_commit_id,revision,content_hash,message,file_count,created_at
    FROM builder_internal_repo_commits WHERE id=?`).bind(commitId).first<any>();
  return {
    provider: 'izakhono-internal',
    slug: project.slug,
    visibility: 'private',
    head_commit_id: commitId,
    commit: publicCommit(row || { id: commitId, parent_commit_id: parent, revision, content_hash: hash, message, file_count: Object.keys(generated.files).length, created_at: null }),
    reused_existing_snapshot: false,
  };
}

export async function listInternalRepository(env: InternalRepoEnv, projectId: string): Promise<any | null> {
  await ensureInternalRepositorySchema(env);
  const repo = await env.DB.prepare(`SELECT project_id,slug,visibility,head_commit_id,created_at,updated_at
    FROM builder_internal_repositories WHERE project_id=?`).bind(projectId).first<any>();
  if (!repo) return null;
  const rows = await env.DB.prepare(`SELECT id,parent_commit_id,revision,content_hash,message,file_count,created_at
    FROM builder_internal_repo_commits WHERE project_id=? ORDER BY created_at DESC, id DESC LIMIT 100`)
    .bind(projectId).all<any>();
  return {
    provider: 'izakhono-internal',
    project_id: repo.project_id,
    slug: repo.slug,
    visibility: repo.visibility,
    head_commit_id: repo.head_commit_id,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
    commits: (rows.results || []).map(publicCommit),
  };
}

export async function readInternalRepositoryCommit(env: InternalRepoEnv, projectId: string, commitId: string): Promise<any | null> {
  await ensureInternalRepositorySchema(env);
  const row = await env.DB.prepare(`SELECT id,project_id,parent_commit_id,revision,content_hash,message,files_json,file_count,created_at
    FROM builder_internal_repo_commits WHERE project_id=? AND id=?`).bind(projectId, commitId).first<any>();
  if (!row) return null;
  let files: Record<string, string> = {};
  try { files = JSON.parse(row.files_json || '{}'); } catch { files = {}; }
  return { ...publicCommit(row), project_id: row.project_id, files };
}
