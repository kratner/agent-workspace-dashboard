import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { isNewer, sha256, vsixAsset } from '../src/update/releaseClient';

test('update check compares versions numerically, not as text', () => {
  assert.equal(isNewer('0.5.0', '0.4.0'), true);
  assert.equal(isNewer('v0.10.0', '0.9.9'), true, '10 > 9, and a leading v is ignored');
  assert.equal(isNewer('1.0.0', '0.99.99'), true);
  assert.equal(isNewer('0.4.0', '0.4.0'), false, 'same version is not an update');
  assert.equal(isNewer('0.3.9', '0.4.0'), false, 'older is not an update');
  assert.equal(isNewer('0.4', '0.4.0'), false, 'missing parts count as 0');
});

test('picks the .vsix out of a release', () => {
  const release = {
    tag_name: 'v1.0.0',
    html_url: '',
    assets: [
      { name: 'notes.txt', browser_download_url: '', size: 1 },
      { name: 'x-1.0.0.vsix', browser_download_url: 'u', size: 2 },
    ],
  };
  assert.equal(vsixAsset(release)?.name, 'x-1.0.0.vsix');
  assert.equal(vsixAsset({ ...release, assets: [] }), undefined);
});

test('sha256 matches the known digest of a file', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'awd-update-')), 'abc.txt');
  fs.writeFileSync(file, 'abc');
  assert.equal(await sha256(file), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
