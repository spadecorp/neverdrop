const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const packageJson = require('../package.json');

const repoFile = (name) => path.join(__dirname, '..', name);

test('Windows installer and portable builds use the SPaDe application icon', () => {
  assert.equal(packageJson.build.win.icon, 'electron/assets/neverdrop.ico');
  assert.equal(packageJson.build.nsis.installerIcon, 'electron/assets/neverdrop.ico');
  assert.equal(packageJson.build.nsis.uninstallerIcon, 'electron/assets/neverdrop.ico');
  const icon = fs.readFileSync(repoFile('electron/assets/neverdrop.ico'));
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  assert.ok(icon.readUInt16LE(4) >= 5);
});

test('packaged app window and sidebar have usable image references', () => {
  assert.ok(fs.existsSync(repoFile('electron/assets/neverdrop.png')));
  assert.ok(fs.existsSync(repoFile('public/spade-wordmark.png')));
  const main = fs.readFileSync(repoFile('electron/main.js'), 'utf8');
  assert.match(main, /icon: path\.join\(__dirname, 'assets', 'neverdrop\.png'\)/);
  const sidebar = fs.readFileSync(repoFile('src/components/sidebar/Sidebar.jsx'), 'utf8');
  assert.match(sidebar, /import\.meta\.env\.BASE_URL/);
  assert.doesNotMatch(sidebar, /src="\/spade-wordmark\.png"/);
});
