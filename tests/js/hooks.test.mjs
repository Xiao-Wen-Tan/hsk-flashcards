import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { HOOK_NAMES, createHooks, loadPlugins } from '../../docs/js/hooks.js';
import { PLUGINS } from '../../docs/js/plugins.js';

test('handlers run in order, and a failing one is logged and skipped', async () => {
  const logged = [];
  const hooks = createHooks({ log: (...args) => logged.push(args[0]) });
  const calls = [];
  hooks.on('sessionEnd', (arg) => { calls.push(['a', arg.result]); });
  hooks.on('sessionEnd', () => { throw new Error('offline'); });
  hooks.on('sessionEnd', async (arg) => { calls.push(['c', arg.result]); });
  await hooks.emit('sessionEnd', { result: 1 });
  assert.deepEqual(calls, [['a', 1], ['c', 1]]);
  assert.deepEqual(logged, ['Hook sessionEnd failed:']);
  await hooks.emit('open', {}); // no handlers is fine
});

test('only the known hooks exist', () => {
  assert.deepEqual(HOOK_NAMES, ['open', 'hidden', 'sessionEnd', 'settings', 'rewound']);
  assert.throws(() => createHooks().on('sometimes', () => {}), /Unknown hook/);
});

test('plugins are installed with the app context, and a broken one is skipped', async () => {
  const hooks = createHooks();
  const installed = [];
  const modules = {
    './good.js': { install: ({ on, store }) => { installed.push(store); on('open', () => {}); } },
    './broken.js': { install: () => { throw new Error('bad'); } },
  };
  const logged = [];
  await loadPlugins(['./broken.js', './good.js', './missing.js'], { on: hooks.on, store: 'S' }, {
    importer: async (p) => { if (!modules[p]) throw new Error('404'); return modules[p]; },
    log: (msg) => logged.push(msg),
  });
  assert.deepEqual(installed, ['S']);
  assert.deepEqual(logged, ['Plugin ./broken.js failed:', 'Plugin ./missing.js failed:']);
});

test('the plugin list names only modules that exist in docs/js/', () => {
  for (const path of PLUGINS) assert.ok(existsSync(new URL(`../../docs/js/${path}`, import.meta.url)), path);
});
