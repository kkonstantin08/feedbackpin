import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('.e2e-extension');
const sourceManifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
if (
  JSON.stringify(sourceManifest.permissions) !==
  JSON.stringify(['activeTab', 'scripting'])
) {
  throw new Error('Production extension permissions changed unexpectedly.');
}

await rm(output, { recursive: true, force: true });
await cp('dist', output, { recursive: true });
await writeFile(
  path.join(output, 'manifest.json'),
  `${JSON.stringify(
    {
      ...sourceManifest,
      host_permissions: ['<all_urls>'],
    },
    null,
    2,
  )}\n`,
);
