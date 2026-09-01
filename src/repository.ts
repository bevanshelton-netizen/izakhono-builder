export type RepositoryCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

const PREVIEW_SECRETS = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];

function cleanSlug(value: unknown): string {
  const slug = String(value || 'izakhono-app').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'izakhono-app';
}

function previewPrefix(slug: string): string {
  return (`izk-${slug}`).slice(0, 48).replace(/-+$/g, '') || 'izk-preview';
}

function lines(values: string[]): string {
  return values.join('\n') + '\n';
}

export function generatedRepositoryFiles(project: any): Record<string, string> {
  const slug = cleanSlug(project?.slug);
  const prefix = previewPrefix(slug);

  const ci = lines([
    'name: IZAKHONO Generated App CI',
    '',
    'on:',
    '  push:',
    '  pull_request:',
    '  workflow_dispatch:',
    '',
    'permissions:',
    '  contents: read',
    '',
    'jobs:',
    '  validate:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Checkout',
    '        uses: actions/checkout@v7',
    '      - name: Set up Node',
    '        uses: actions/setup-node@v6',
    '        with:',
    "          node-version: '22'",
    '      - name: Install dependencies',
    '        run: npm install --ignore-scripts --no-audit --no-fund',
    '      - name: Validate generated application',
    '        run: npm run validate',
  ]);

  const preview = lines([
    'name: IZAKHONO Isolated Preview',
    '',
    'on:',
    '  pull_request:',
    '    types: [opened, synchronize, reopened]',
    '  workflow_dispatch:',
    '',
    'permissions:',
    '  contents: read',
    '',
    'env:',
    '  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}',
    '  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
    '',
    'jobs:',
    '  preview:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Checkout',
    '        uses: actions/checkout@v7',
    '      - name: Set up Node',
    '        uses: actions/setup-node@v6',
    '        with:',
    "          node-version: '22'",
    '      - name: Install dependencies',
    '        run: npm install --ignore-scripts --no-audit --no-fund',
    '      - name: Validate preview candidate',
    '        run: npm run validate',
    '      - name: Record credential gate',
    "        if: ${{ env.CLOUDFLARE_API_TOKEN == '' || env.CLOUDFLARE_ACCOUNT_ID == '' }}",
    "        run: echo 'Provider preview is credential-gated. Configure the two repository secrets; no credential is ever generated into source.'",
    '      - name: Deploy isolated pull-request preview',
    "        if: ${{ github.event_name == 'pull_request' && env.CLOUDFLARE_API_TOKEN != '' && env.CLOUDFLARE_ACCOUNT_ID != '' }}",
    '        run: npx wrangler deploy --name "' + prefix + '-pr-${{ github.event.number }}"',
    '      - name: Deploy isolated manual preview',
    "        if: ${{ github.event_name == 'workflow_dispatch' && env.CLOUDFLARE_API_TOKEN != '' && env.CLOUDFLARE_ACCOUNT_ID != '' }}",
    '        run: npx wrangler deploy --name "' + prefix + '-manual"',
  ]);

  const contract = {
    schema: 'izakhono.repository/v1',
    generated_by: 'IZAKHONO BUILDER',
    repository: {
      name: slug,
      visibility: 'private',
      overwrite_existing: false,
    },
    ci: {
      workflow: '.github/workflows/izakhono-generated-ci.yml',
      required_command: 'npm run validate',
    },
    preview: {
      builder_preview: 'versioned-technical-preview',
      provider: 'cloudflare-worker',
      workflow: '.github/workflows/izakhono-isolated-preview.yml',
      isolated_per_pull_request: true,
      provider_secrets: PREVIEW_SECRETS,
      note: 'Provider credentials are repository secrets and are never generated into source.',
    },
  };

  const gitignore = lines([
    'node_modules/',
    '.wrangler/',
    'dist/',
    '.dev.vars',
    '.env',
    '.env.*',
    '!.env.example',
    '*.log',
  ]);

  return {
    '.github/workflows/izakhono-generated-ci.yml': ci,
    '.github/workflows/izakhono-isolated-preview.yml': preview,
    '.izakhono.repository.json': JSON.stringify(contract, null, 2),
    '.gitignore': gitignore,
  };
}

export function validateRepositoryFiles(project: any, files: Record<string, string>): RepositoryCheck[] {
  const ci = String(files['.github/workflows/izakhono-generated-ci.yml'] || '');
  const preview = String(files['.github/workflows/izakhono-isolated-preview.yml'] || '');
  const gitignore = String(files['.gitignore'] || '');
  let contract: any = {};
  try { contract = JSON.parse(String(files['.izakhono.repository.json'] || '')); } catch { contract = {}; }

  return [
    {
      name: 'repository_contract',
      passed: contract?.schema === 'izakhono.repository/v1' && contract?.repository?.name === cleanSlug(project?.slug),
      detail: 'Generated repository metadata identifies the intended project and schema.',
    },
    {
      name: 'private_repository_default',
      passed: contract?.repository?.visibility === 'private' && contract?.repository?.overwrite_existing === false,
      detail: 'Repository automation defaults to private and refuses overwrite.',
    },
    {
      name: 'generated_ci_workflow',
      passed: ci.includes('permissions:\n  contents: read') && ci.includes('npm run validate') && ci.includes('workflow_dispatch:'),
      detail: 'Generated repository has a least-privilege validation workflow.',
    },
    {
      name: 'isolated_preview_workflow',
      passed: preview.includes('pull_request:') && preview.includes('wrangler deploy --name') && preview.includes('-pr-${{ github.event.number }}'),
      detail: 'Generated repository has an isolated pull-request preview workflow.',
    },
    {
      name: 'safe_preview_trigger',
      passed: !preview.includes('pull_request_target') && preview.includes('${{ secrets.CLOUDFLARE_API_TOKEN }}') && preview.includes('${{ secrets.CLOUDFLARE_ACCOUNT_ID }}'),
      detail: 'Preview deployment uses repository secrets without pull_request_target.',
    },
    {
      name: 'local_secret_exclusions',
      passed: gitignore.includes('.dev.vars') && gitignore.includes('.env') && gitignore.includes('.wrangler/'),
      detail: 'Common local secret and provider state files are excluded from source control.',
    },
  ];
}

export function repositoryAutomationCapabilities(env: any) {
  const owner = String(env?.GITHUB_OWNER || '').trim();
  const token = String(env?.GITHUB_AUTOMATION_TOKEN || '').trim();
  const kind = String(env?.GITHUB_OWNER_KIND || 'user').trim().toLowerCase();
  return {
    repository_package: true,
    generated_ci: true,
    versioned_builder_preview: true,
    github_repository_publish: Boolean(owner && token && (kind === 'user' || kind === 'org')),
    github_owner_kind: owner ? kind : null,
    provider_preview_workflow: true,
    provider_preview_credentials_required: PREVIEW_SECRETS,
  };
}

type GitHubResult = {
  status: number;
  ok: boolean;
  data: any;
};

async function githubRequest(token: string, path: string, init: RequestInit = {}): Promise<GitHubResult> {
  const headers = new Headers(init.headers || {});
  headers.set('accept', 'application/vnd.github+json');
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-github-api-version', '2022-11-28');
  headers.set('user-agent', 'izakhono-builder');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const response = await fetch(`https://api.github.com${path}`, { ...init, headers });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text ? { message: text.slice(0, 240) } : null; }
  return { status: response.status, ok: response.ok, data };
}

function githubError(result: GitHubResult, fallback: string): string {
  const message = typeof result?.data?.message === 'string' ? result.data.message : fallback;
  return message.slice(0, 300);
}

async function waitForHead(token: string, owner: string, repo: string, branch: string): Promise<GitHubResult> {
  let result: GitHubResult = { status: 404, ok: false, data: null };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    result = await githubRequest(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`);
    if (result.ok) return result;
    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return result;
}

export async function publishGeneratedRepository(env: any, project: any, generated: any): Promise<any> {
  const token = String(env?.GITHUB_AUTOMATION_TOKEN || '').trim();
  const owner = String(env?.GITHUB_OWNER || '').trim();
  const kind = String(env?.GITHUB_OWNER_KIND || 'user').trim().toLowerCase();
  const repo = cleanSlug(project?.slug);

  if (!generated?.validation?.passed || !generated?.files) {
    return { ok: false, status: 409, error: 'Generated bundle must pass validation before repository publication.' };
  }
  if (!token || !owner) {
    return {
      ok: false,
      status: 409,
      error: 'Repository publishing is not configured on the Builder runtime.',
      required_server_secrets: ['GITHUB_AUTOMATION_TOKEN', 'GITHUB_OWNER'],
      optional_server_setting: 'GITHUB_OWNER_KIND=user|org',
    };
  }
  if (kind !== 'user' && kind !== 'org') {
    return { ok: false, status: 409, error: 'GITHUB_OWNER_KIND must be user or org.' };
  }

  if (kind === 'user') {
    const identity = await githubRequest(token, '/user');
    if (!identity.ok) return { ok: false, status: 502, error: `GitHub identity check failed: ${githubError(identity, 'unknown GitHub error')}` };
    if (String(identity.data?.login || '').toLowerCase() !== owner.toLowerCase()) {
      return { ok: false, status: 409, error: 'Configured GITHUB_OWNER does not match the automation token owner.' };
    }
  }

  const existing = await githubRequest(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if (existing.ok) {
    return { ok: false, status: 409, error: 'Repository already exists; IZAKHONO will not overwrite it.', repository: `${owner}/${repo}` };
  }
  if (existing.status !== 404) {
    return { ok: false, status: 502, error: `GitHub repository check failed: ${githubError(existing, 'unknown GitHub error')}` };
  }

  const createPath = kind === 'org' ? `/orgs/${encodeURIComponent(owner)}/repos` : '/user/repos';
  const created = await githubRequest(token, createPath, {
    method: 'POST',
    body: JSON.stringify({
      name: repo,
      private: true,
      auto_init: true,
      description: `Generated by IZAKHONO BUILDER for ${String(project?.name || repo).slice(0, 160)}`,
    }),
  });
  if (!created.ok) {
    return { ok: false, status: 502, error: `GitHub repository creation failed: ${githubError(created, 'unknown GitHub error')}` };
  }

  const fullName = String(created.data?.full_name || `${owner}/${repo}`);
  const htmlUrl = String(created.data?.html_url || `https://github.com/${fullName}`);
  const defaultBranch = String(created.data?.default_branch || 'main');

  try {
    const head = await waitForHead(token, owner, repo, defaultBranch);
    if (!head.ok) throw new Error(`initial branch not ready: ${githubError(head, 'GitHub did not expose the initial branch')}`);
    const parentSha = String(head.data?.object?.sha || '');
    if (!parentSha) throw new Error('initial branch did not return a commit SHA');

    const parent = await githubRequest(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${encodeURIComponent(parentSha)}`);
    if (!parent.ok) throw new Error(`initial commit lookup failed: ${githubError(parent, 'unknown GitHub error')}`);
    const baseTree = String(parent.data?.tree?.sha || '');
    if (!baseTree) throw new Error('initial commit did not return a tree SHA');

    const tree: any[] = [];
    for (const path of Object.keys(generated.files).sort()) {
      const content = String(generated.files[path]);
      const blob = await githubRequest(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content, encoding: 'utf-8' }),
      });
      if (!blob.ok || !blob.data?.sha) throw new Error(`blob creation failed for ${path}: ${githubError(blob, 'unknown GitHub error')}`);
      tree.push({ path, mode: '100644', type: 'blob', sha: blob.data.sha });
    }

    const newTree = await githubRequest(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTree, tree }),
    });
    if (!newTree.ok || !newTree.data?.sha) throw new Error(`tree creation failed: ${githubError(newTree, 'unknown GitHub error')}`);

    const commit = await githubRequest(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: `Initialize ${String(project?.name || repo)} with IZAKHONO BUILDER`,
        tree: newTree.data.sha,
        parents: [parentSha],
      }),
    });
    if (!commit.ok || !commit.data?.sha) throw new Error(`commit creation failed: ${githubError(commit, 'unknown GitHub error')}`);

    const moved = await githubRequest(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(defaultBranch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.data.sha, force: false }),
    });
    if (!moved.ok) throw new Error(`branch update failed: ${githubError(moved, 'unknown GitHub error')}`);

    return {
      ok: true,
      status: 201,
      repository: {
        full_name: fullName,
        url: htmlUrl,
        visibility: 'private',
        default_branch: defaultBranch,
        commit_sha: commit.data.sha,
      },
      generated_file_count: Object.keys(generated.files).length,
      provider_preview: {
        workflow_generated: true,
        repository_secrets_required: PREVIEW_SECRETS,
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 502,
      error: `Private repository was created but the generated source commit did not complete: ${String(error?.message || error).slice(0, 300)}`,
      repository: { full_name: fullName, url: htmlUrl, visibility: 'private', default_branch: defaultBranch },
      safe_to_retry: false,
      note: 'IZAKHONO will not overwrite the repository automatically. Inspect or remove the initialized repository before retrying.',
    };
  }
}
