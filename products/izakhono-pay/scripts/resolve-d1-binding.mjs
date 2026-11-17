import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACEHOLDER_DATABASE_ID = '00000000-0000-0000-0000-000000000000';

function parseListPayload(payload) {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const candidates = [
    parsed,
    parsed && parsed.result,
    parsed && parsed.databases,
    parsed && parsed.data,
    parsed && parsed.result && parsed.result.databases,
    parsed && parsed.result && parsed.result.result,
    parsed && parsed.result && parsed.result.data,
  ];
  return candidates.find(Array.isArray) || null;
}

export function resolveDatabaseId(payload, databaseName) {
  if (!databaseName || !databaseName.trim()) throw new Error('D1_DATABASE_NAME_REQUIRED');
  const rows = parseListPayload(payload);
  if (!rows) throw new Error('D1_LIST_RESPONSE_UNRECOGNIZED');

  const matches = rows.filter((row) =>
    row && typeof row === 'object' &&
    (row.name === databaseName || row.database_name === databaseName)
  );

  if (matches.length === 0) throw new Error('D1_DATABASE_NOT_FOUND:' + databaseName);
  if (matches.length !== 1) throw new Error('D1_DATABASE_NAME_AMBIGUOUS:' + databaseName);

  const id = matches[0].uuid || matches[0].database_id || matches[0].databaseId || matches[0].id;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    throw new Error('D1_DATABASE_ID_INVALID:' + databaseName);
  }
  return id;
}

export function injectDatabaseId(configText, options) {
  const databaseName = options && options.databaseName;
  const binding = options && options.binding;
  const databaseId = options && options.databaseId;
  if (typeof configText !== 'string' || !configText.trim()) throw new Error('WRANGLER_CONFIG_REQUIRED');
  if (!databaseName || !/^[A-Za-z0-9_-]+$/.test(databaseName) || !binding || !/^[A-Za-z0-9_]+$/.test(binding)) {
    throw new Error('D1_BINDING_IDENTITY_REQUIRED');
  }
  if (typeof databaseId !== 'string' || !UUID_PATTERN.test(databaseId)) throw new Error('D1_DATABASE_ID_INVALID');

  const blocks = [...configText.matchAll(/\{[^{}]*\}/g)].map((match) => match[0]);
  const bindingPattern = new RegExp('"binding"\\s*:\\s*"' + binding + '"');
  const databasePattern = new RegExp('"database_name"\\s*:\\s*"' + databaseName + '"');
  const matches = blocks.filter((block) => bindingPattern.test(block) && databasePattern.test(block));

  if (matches.length === 0) throw new Error('D1_BINDING_NOT_FOUND:' + binding + ':' + databaseName);
  if (matches.length !== 1) throw new Error('D1_BINDING_AMBIGUOUS:' + binding + ':' + databaseName);

  const block = matches[0];
  const existing = block.match(/"database_id"\s*:\s*"([^"]+)"/);
  if (existing && existing[1] !== databaseId && existing[1] !== PLACEHOLDER_DATABASE_ID) throw new Error('D1_CONFIG_ID_MISMATCH');
  if (existing && existing[1] === databaseId) return configText;
  if (existing) {
    const updatedBlock = block.replace(/("database_id"\s*:\s*")[^"]+("\)/, '$1' + databaseId + '$2');
    return configText.replace(block, updatedBlock);
  }

  const nameProperty = new RegExp('("database_name"\\s*:\\s*"' + databaseName + '")\\s*,?');
  const updatedBlock = block.replace(nameProperty, '$1,\n      "database_id": "' + databaseId + '",');
  if (updatedBlock === block) throw new Error('D1_DATABASE_NAME_PROPERTY_NOT_UPDATED');
  return configText.replace(block, updatedBlock);
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !key.startsWith('--') || !value) throw new Error('INVALID_ARGUMENTS');
    values[key.slice(2)] = value;
  }
  for (const key of ['config', 'output', 'database', 'binding']) {
    if (!values[key]) throw new Error('ARGUMENT_REQUIRED:--' + key);
  }
  values['list-config'] = values['list-config'] || 'wrangler.ci.jsonc';
  return values;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const configPath = path.resolve(args.config);
  const outputPath = path.resolve(args.output);
  const workingDirectory = path.dirname(configPath);

  const listOutput = execFileSync('npx', [
    'wrangler', 'd1', 'list', '--json', '--config', args['list-config'],
  ], { cwd: workingDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  const databaseId = resolveDatabaseId(listOutput, args.database);
  const source = fs.readFileSync(configPath, 'utf8');
  const resolved = injectDatabaseId(source, {
    databaseName: args.database,
    binding: args.binding,
    databaseId,
  });

  fs.writeFileSync(outputPath, resolved, 'utf8');
  process.stdout.write('Resolved ' + args.binding + ' to the existing D1 database "' + args.database + '".\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : 'D1_BINDING_RESOLUTION_FAILED') + '\n');
    process.exitCode = 1;
  }
}
