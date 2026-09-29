// Runs the quiz-choice rules on every word of the real data file, once Plan 3 has
// written docs/data/words_vNNN.json. Until then the test is skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { buildChoices, makePool, meaningKeys, pickDistractors } from '../../docs/js/distractors.js';
import { brokenRules } from './helpers.mjs';

const dataDir = new URL('../../docs/data/', import.meta.url);
const files = existsSync(dataDir) ? readdirSync(dataDir).filter((f) => /^words_v\d{3}\.json$/.test(f)).sort() : [];

test('every real word gets 3 valid wrong choices', { skip: files.length === 0 && 'no docs/data/words_vNNN.json yet' }, () => {
  const data = JSON.parse(readFileSync(new URL(files.at(-1), dataDir), 'utf8'));
  const pool = makePool(data.words);
  const problems = [];
  for (const answer of data.words) {
    for (const quiz of ['listen', 'pinyin']) {
      const wrong = pickDistractors(pool, answer, quiz, { day: '2026-10-05', step: 2 });
      problems.push(...brokenRules(data.words, meaningKeys, answer, quiz, wrong, 2));
    }
  }
  for (const answer of data.words.slice(0, 100)) {
    assert.equal(buildChoices(pool, answer, 'pinyin', { day: '2026-10-05', step: 2 }).choices.length, 4);
  }
  assert.deepEqual(problems.slice(0, 20), []);
});
