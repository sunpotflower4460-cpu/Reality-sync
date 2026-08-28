import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const native = readFileSync(new URL('../ios/RealitySync/ViewController.swift', import.meta.url), 'utf8');

test('native script message handlers do not retain the root view controller', () => {
  assert.match(native, /private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler/);
  assert.match(native, /weak var delegate: WKScriptMessageHandler\?/);
  assert.match(native, /delegate\?\.userContentController\(userContentController, didReceive: message\)/);
  assert.match(native, /add\(WeakScriptMessageHandler\(delegate: self\), name: Self\.backupExportHandler\)/);
  assert.match(native, /add\(WeakScriptMessageHandler\(delegate: self\), name: Self\.backupImportHandler\)/);
  assert.doesNotMatch(native, /userContentController\.add\(self, name:/);
});
