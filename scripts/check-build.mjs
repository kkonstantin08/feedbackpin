import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('dist');
const manifest = JSON.parse(
  await readFile(path.join(output, 'manifest.json'), 'utf8'),
);
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions?.toSorted(), ['activeTab', 'scripting']);
for (const field of [
  'host_permissions',
  'optional_host_permissions',
  'optional_permissions',
  'content_scripts',
]) {
  assert.equal(field in manifest, false, `Unexpected manifest field: ${field}`);
}
assert.equal(manifest.background?.type, 'module');
for (const artifact of [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_page,
]) {
  assert.equal(typeof artifact, 'string', 'Missing manifest artifact path');
  const artifactPath = path.resolve(output, artifact);
  assert.ok(
    artifactPath.startsWith(`${output}${path.sep}`),
    'Artifact must stay inside dist',
  );
  assert.ok(
    (await stat(artifactPath)).isFile(),
    `Missing artifact: ${artifact}`,
  );
}
console.log('MV3 build assertion passed.');
