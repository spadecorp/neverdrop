const test = require('node:test');
const assert = require('node:assert/strict');
const packageJson = require('../package.json');

test('production package includes Electron entry points and built renderer', () => {
  assert.equal(packageJson.main, 'electron/main.js');
  assert.ok(packageJson.build.files.includes('electron/**/*'));
  assert.ok(packageJson.build.files.includes('dist/**/*'));
  assert.ok(packageJson.build.files.includes('LICENSE'), 'Distribute MIT license with packaged app');
});

test('native modules are unpacked from ASAR', () => {
  assert.equal(packageJson.build.asar, true);
  assert.ok(packageJson.build.asarUnpack.includes('node_modules/better-sqlite3/**/*'));
  assert.ok(packageJson.build.asarUnpack.includes('node_modules/keytar/**/*'));
});
