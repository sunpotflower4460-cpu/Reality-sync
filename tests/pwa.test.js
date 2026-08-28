import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('PWA manifest uses relative install paths, light shell colors and a scalable icon', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'RealitySync');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#ffffff');
  assert.equal(manifest.background_color, '#f6f7fb');
  assert.equal(manifest.icons.some((icon) => icon.src === './icon.svg' && icon.type === 'image/svg+xml'), true);
});

test('service worker scopes runtime caching, awaits writes and bounds old hashed assets', async () => {
  const worker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /addEventListener\('fetch'/);
  assert.match(worker, /addEventListener\('notificationclick'/);
  assert.match(worker, /MAX_RUNTIME_ASSET_ENTRIES/);
  assert.match(worker, /event\.waitUntil\(putResponse\(request, response\)\)/);
  assert.match(worker, /url\.href\.startsWith\(scopeUrl\.href\)/);
  assert.match(worker, /client\.url\.startsWith\(scopeUrl\.href\)/);
});

test('PWA install prompt is consumed before awaiting and cannot reject into the UI event loop', async () => {
  const hook = await readFile(new URL('../src/hooks/usePwaInstall.js', import.meta.url), 'utf8');
  const inFlightGuard = hook.indexOf('if (!promptEvent || installInFlightRef.current) return null;');
  const consumePrompt = hook.indexOf('installInFlightRef.current = true;', inFlightGuard);
  const promptCall = hook.indexOf('await promptEvent.prompt();', consumePrompt);
  const catchBlock = hook.indexOf('} catch {', promptCall);
  assert.ok(inFlightGuard >= 0);
  assert.ok(consumePrompt > inFlightGuard);
  assert.ok(promptCall > consumePrompt);
  assert.ok(catchBlock > promptCall);
  assert.match(hook, /setInstallPrompt\(\(current\) => current === promptEvent \? null : current\)/);
  assert.match(hook, /finally \{\s*installInFlightRef\.current = false;/s);
});

test('HTML links install assets and uses light browser theme chrome', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8'));
  assert.match(html, /name="theme-color" content="#ffffff"/);
  assert.match(html, /href="\.\/manifest\.webmanifest"/);
  assert.match(html, /href="\.\/icon\.svg"/);
});
