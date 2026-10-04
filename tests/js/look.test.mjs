// The bright look (spec of 2026-10-03, section 4), checked in the files the browser reads. The
// browser check `node tests/browser/check.mjs look` checks the same in Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../docs/${path}`, import.meta.url), 'utf8');
const css = read('css/app.css');

test('the app is always light, also when the phone is in dark mode', () => {
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /color-scheme: light;/);
  assert.match(css, /--bg: #ffffff;/);
  assert.match(css, /body \{[^}]*background: var\(--bg\);/);
});

test('all motion stops when the phone asks for reduced motion', () => {
  const at = css.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(at >= 0, 'no reduced-motion block');
  const block = css.slice(at);
  assert.match(block, /animation: none !important;/);
  assert.match(block, /transition: none !important;/);
});

test('buttons and the bottom bar are at least 48 pixels high', () => {
  assert.match(css, /button, \.button \{[^}]*min-height: 3rem;/);
  assert.match(css, /button\.small \{[^}]*min-height: 3rem;/);
  assert.match(css, /nav a \{[^}]*min-height: 3rem;/);
});

test('the page and the installed app use the warm orange-red main colour', () => {
  const accent = css.match(/--accent: (#[0-9a-f]{6});/)[1];
  assert.equal(accent, '#d63c1f');
  assert.match(read('index.html'), new RegExp(`<meta name="theme-color" content="${accent}">`));
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.deepEqual([manifest.theme_color, manifest.background_color], [accent, '#ffffff']);
});
