import {
  commitInternalRepository,
  listInternalRepository,
  readInternalRepositoryCommit,
} from '../src/internal-repository';

type RepoRow = {
  project_id: string;
  slug: string;
  visibility: 'private';
  head_commit_id: string | null;
  created_at: string;
  updated_at: string;
};

type CommitRow = {
  id: string;
  project_id: string;
  parent_commit_id: string | null;
  revision: string;
  content_hash: string;
  message: string;
  files_json: string;
  file_count: number;
  created_at: string;
};

function normalized(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

class FakeStatement {
  private values: unknown[] = [];
  constructor(private db: FakeD1, private sql: string) {}
  bind(...values: unknown[]): FakeStatement { this.values = values; return this; }

  async run(): Promise<unknown> {
    const q = normalized(this.sql);
    if (q.startsWith('create table') || q.startsWith('create index')) return { success: true };

    if (q.startsWith('insert or ignore into builder_internal_repositories')) {
      const [projectId, slug] = this.values.map(String);
      if (!this.db.repos.has(projectId)) {
        const now = this.db.now();
        this.db.repos.set(projectId, {
          project_id: projectId,
          slug,
          visibility: 'private',
          head_commit_id: null,
          created_at: now,
          updated_at: now,
        });
      }
      return { success: true };
    }

    if (q.startsWith('update builder_internal_repositories set head_commit_id=')) {
      const [head, projectId] = this.values.map(String);
      const repo = this.db.repos.get(projectId);
      if (!repo) throw new Error(`missing fake repository ${projectId}`);
      repo.head_commit_id = head;
      repo.updated_at = this.db.now();
      return { success: true };
    }

    if (q.startsWith('insert into builder_internal_repo_commits')) {
      const [id, projectId, parent, revision, hash, message, filesJson, fileCount] = this.values;
      const key = `${String(projectId)}:${String(hash)}`;
      if (this.db.hashIndex.has(key)) throw new Error('duplicate content hash');
      const row: CommitRow = {
        id: String(id),
        project_id: String(projectId),
        parent_commit_id: parent == null ? null : String(parent),
        revision: String(revision),
        content_hash: String(hash),
        message: String(message),
        files_json: String(filesJson),
        file_count: Number(fileCount),
        created_at: this.db.now(),
      };
      this.db.commits.set(row.id, row);
      this.db.hashIndex.set(key, row.id);
      return { success: true };
    }

    throw new Error(`unsupported fake D1 run query: ${q}`);
  }

  async first<T = any>(): Promise<T | null> {
    const q = normalized(this.sql);

    if (q.includes('from builder_internal_repo_commits where project_id=? and content_hash=?')) {
      const [projectId, hash] = this.values.map(String);
      const id = this.db.hashIndex.get(`${projectId}:${hash}`);
      return (id ? this.db.commits.get(id) : null) as T | null;
    }

    if (q.startsWith('select head_commit_id from builder_internal_repositories where project_id=?')) {
      return (this.db.repos.get(String(this.values[0])) || null) as T | null;
    }

    if (q.includes('from builder_internal_repo_commits where id=?')) {
      return (this.db.commits.get(String(this.values[0])) || null) as T | null;
    }

    if (q.includes('from builder_internal_repositories where project_id=?')) {
      return (this.db.repos.get(String(this.values[0])) || null) as T | null;
    }

    if (q.includes('from builder_internal_repo_commits where project_id=? and id=?')) {
      const [projectId, id] = this.values.map(String);
      const row = this.db.commits.get(id);
      return (row && row.project_id === projectId ? row : null) as T | null;
    }

    throw new Error(`unsupported fake D1 first query: ${q}`);
  }

  async all<T = any>(): Promise<{ results?: T[] }> {
    const q = normalized(this.sql);
    if (q.includes('from builder_internal_repo_commits where project_id=? order by created_at desc')) {
      const projectId = String(this.values[0]);
      const rows = [...this.db.commits.values()]
        .filter(row => row.project_id === projectId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      return { results: rows as T[] };
    }
    throw new Error(`unsupported fake D1 all query: ${q}`);
  }
}

class FakeD1 {
  repos = new Map<string, RepoRow>();
  commits = new Map<string, CommitRow>();
  hashIndex = new Map<string, string>();
  private tick = 0;
  prepare(sql: string): FakeStatement { return new FakeStatement(this, sql); }
  now(): string { this.tick += 1; return new Date(1_800_000_000_000 + this.tick * 1000).toISOString(); }
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`[FAIL] ${message}`);
}

async function main() {
  const DB = new FakeD1();
  const env: any = { DB };
  const project = { id: 'project_canary', slug: 'internal-repo-canary' };

  const firstBundle = {
    revision: 'aaaaaaaaaaaa',
    validation: { passed: true },
    files: { 'b.txt': 'two', 'a.txt': 'one' },
  };
  const first = await commitInternalRepository(env, project, firstBundle);
  assert(first.visibility === 'private', 'first internal repository must be private');
  assert(first.commit.parent_commit_id === null, 'first commit must have no parent');
  assert(first.commit.file_count === 2, 'first commit must contain two files');
  assert(first.reused_existing_snapshot === false, 'first commit must be new');

  const duplicateBundle = {
    revision: 'bbbbbbbbbbbb',
    validation: { passed: true },
    files: { 'a.txt': 'one', 'b.txt': 'two' },
  };
  const duplicate = await commitInternalRepository(env, project, duplicateBundle);
  assert(duplicate.head_commit_id === first.head_commit_id, 'same canonical files must reuse the same content commit');
  assert(duplicate.reused_existing_snapshot === true, 'duplicate content must report snapshot reuse');
  assert(DB.commits.size === 1, 'duplicate content must not create fake history');

  const changedBundle = {
    revision: 'cccccccccccc',
    validation: { passed: true },
    files: { 'a.txt': 'one', 'b.txt': 'THREE', 'c.txt': 'new' },
  };
  const changed = await commitInternalRepository(env, project, changedBundle);
  assert(changed.head_commit_id !== first.head_commit_id, 'changed content must create a new commit');
  assert(changed.commit.parent_commit_id === first.head_commit_id, 'changed commit must point to previous head');
  assert(changed.commit.file_count === 3, 'changed commit must record its file count');

  const repository = await listInternalRepository(env, project.id);
  assert(repository?.visibility === 'private', 'listed repository must remain private');
  assert(repository?.head_commit_id === changed.head_commit_id, 'repository head must advance to changed commit');
  assert(repository?.commits.length === 2, 'repository history must contain exactly two content commits');

  const original = await readInternalRepositoryCommit(env, project.id, first.head_commit_id);
  assert(original?.files['a.txt'] === 'one', 'original commit must restore a.txt exactly');
  assert(original?.files['b.txt'] === 'two', 'original commit must restore b.txt exactly');
  assert(Object.keys(original?.files || {}).length === 2, 'original snapshot must not inherit later files');

  const latest = await readInternalRepositoryCommit(env, project.id, changed.head_commit_id);
  assert(latest?.files['b.txt'] === 'THREE', 'latest commit must recover changed content');
  assert(latest?.files['c.txt'] === 'new', 'latest commit must recover new files');

  let rejected = false;
  try {
    await commitInternalRepository(env, project, { revision: 'dddddddddddd', validation: { passed: false }, files: { 'x': 'bad' } });
  } catch {
    rejected = true;
  }
  assert(rejected, 'unvalidated source must be rejected');
  assert(DB.commits.size === 2, 'rejected source must not mutate repository history');

  console.log('[PASS] IZAKHONO internal repository canary: private source, content addressing, deduplication, parent history, exact restore and validation boundary all passed.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  throw error;
});
