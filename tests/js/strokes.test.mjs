import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charsOf, loadStrokeData, strokeUrl } from '../../docs/js/strokes.js';

test('only Chinese characters get a stroke animation', () => {
  assert.deepEqual(charsOf('苹果'), ['苹', '果']);
  assert.deepEqual(charsOf('虽然…但是…'), ['虽', '然', '但', '是']);
  assert.deepEqual(charsOf('卡拉OK'), ['卡', '拉']);
});

test('stroke files are named by code point', () => {
  assert.equal(strokeUrl('爱'), 'strokes/7231.json');
  assert.equal(strokeUrl('苹'), 'strokes/82f9.json');
});

test('stroke data loads per character, and a missing file gives a plain message', async () => {
  const files = { 'strokes/82f9.json': { strokes: ['a'] }, 'strokes/679c.json': { strokes: ['b'] } };
  const fetchFn = async (url) => (files[url]
    ? { ok: true, json: async () => files[url] }
    : { ok: false, status: 404 });
  const data = await loadStrokeData(['苹', '果'], fetchFn);
  assert.deepEqual([...data.keys()], ['苹', '果']);
  assert.deepEqual(data.get('果'), { strokes: ['b'] });
  await assert.rejects(loadStrokeData(['爱'], fetchFn), /Stroke order for 爱 is not on this phone yet/);
  const offline = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(loadStrokeData(['苹'], offline), /not on this phone yet/);
});
