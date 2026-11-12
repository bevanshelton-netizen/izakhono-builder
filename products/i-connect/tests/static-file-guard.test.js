const test = require('node:test');
const assert = require('node:assert/strict');
const { isPrivateStaticPath } = require('../static-file-guard');

test('blocks server and build metadata files', () => {
  for (const path of ['/server.js', '/package.json', '/package-lock.json', '/Dockerfile', '/docker-compose.yml', '/README.md']) {
    assert.equal(isPrivateStaticPath(path), true, path);
  }
});

test('blocks operator, test, migration and dependency directories', () => {
  for (const path of ['/scripts/bootstrap-owner.js', '/tests/example.test.js', '/migrations/001.sql', '/node_modules/express/index.js', '/.git/config']) {
    assert.equal(isPrivateStaticPath(path), true, path);
  }
});

test('blocks environment files and source maps', () => {
  for (const path of ['/.env', '/.env.example', '/.env.production', '/app.js.map', '/private.yaml']) {
    assert.equal(isPrivateStaticPath(path), true, path);
  }
});

test('blocks encoded paths that resolve to private resources', () => {
  for (const path of ['/scripts%2Fbootstrap-owner.js', '/server%2Ejs', '/%2e%2e%2fserver.js', '/%ZZ']) {
    assert.equal(isPrivateStaticPath(path), true, path);
  }
});

test('allows browser assets and public pages', () => {
  for (const path of ['/', '/index.html', '/styles.css', '/app.js', '/auth.js', '/agent/index.html']) {
    assert.equal(isPrivateStaticPath(path), false, path);
  }
});
