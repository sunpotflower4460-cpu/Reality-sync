import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('PWA manifest uses relative install paths and a scalable icon', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'RealitySync');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.icons.some((icon) => icon.src === './icon.svg' && icon.type === 'image/svg+xml'), true);
});

test('service worker includes offline runtime caching and notification click handling', async () => {
  const worker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /addEventListener\('fetch'/);
  assert.match(worker, /addEventListener\('notificationclick'/);
  assert.match(worker, /CACHE_NAME/);
});

test('HTML links the manifest and icon with relative URLs', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /href="\.\/manifest\.webmanifest"/);
  assert.match(html, /href="\.\/icon\.svg"/);
});
