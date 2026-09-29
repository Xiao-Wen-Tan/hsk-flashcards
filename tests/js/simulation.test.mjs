// A made-up learner studies every day for 450 study days with the default settings
// (100 reviews at most, 12 new words). The chance of a right answer rises with the
// word's step, from 0.85 at steps 1 and 2 through 0.88, 0.91 and 0.93 to 0.95 from step 6.
// The test checks that no day asks more than 100 reviews and prints the daily load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../docs/js/config.js';
import { addDays } from '../../docs/js/dates.js';
import { mulberry32 } from '../../docs/js/rng.js';
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { localDate, syntheticWords } from './helpers.mjs';

const DAYS = 450;
const FIRST_DAY = '2026-10-05';
const RIGHT_BY_STEP = [0.85, 0.85, 0.85, 0.88, 0.91, 0.93, 0.95, 0.95, 0.95, 0.95]; // index = step

function makeData() {
  const words = syntheticWords(DAYS * CONFIG.newPerDay);
  const themes = [...new Set(words.map((w) => w.theme))].map((id, i) => ({ id, order: i + 1, name: `Theme ${i + 1}` }));
  return { words, themes };
}

function minutes(cards) {
  const seconds = cards.reduce((sum, c) => sum + CONFIG.secondsPerCard[c.type], 0);
  return seconds / 60;
}

test('450 simulated days never go over the review cap', { timeout: 120000 }, async () => {
  const data = makeData();
  const store = new MemoryStore();
  const rand = mulberry32(20261005);
  const rows = [];
  for (let d = 0; d < DAYS; d++) {
    const day = addDays(FIRST_DAY, d);
    const now = localDate(day, 20);
    const study = await Study.start({ store, data, now });
    while (!study.finished) {
      const card = study.card;
      if (card.type === 'learn') { study.next(); continue; }
      const step = study.byId.get(card.id)?.step ?? 0;
      const right = rand() < RIGHT_BY_STEP[step];
      const grade = card.quiz === 'recall' ? (right ? 'know' : 'dontknow') : (right ? 'right' : 'wrong');
      await study.answer(grade, now);
    }
    const result = await study.finish(now);
    const cards = study.state.cards;
    rows.push({
      day,
      reviews: study.plan.reviews.length,
      backlog: study.plan.backlog,
      newWords: study.plan.newWords.length,
      reasks: cards.filter((c) => c.type === 'reask').length,
      minutes: minutes(cards),
      checkedIn: result.checkedIn,
    });
  }

  const over = rows.filter((r) => r.reviews > CONFIG.reviewCap);
  assert.deepEqual(over, [], 'no day asks more reviews than the cap');
  assert.ok(rows.every((r) => r.checkedIn), 'a learner who finishes every session checks in every day');

  const avg = (list, key) => (list.reduce((s, r) => s + r[key], 0) / list.length).toFixed(1);
  console.log('\nDaily load of the simulated learner (averages per block of days)');
  console.log('days      reviews  backlog  new  re-asks  minutes  (max reviews)');
  for (let from = 0; from < DAYS; from += 30) {
    const block = rows.slice(from, from + 30);
    const max = Math.max(...block.map((r) => r.reviews));
    console.log(`${String(from + 1).padStart(3)}-${String(from + block.length).padEnd(3)}   ${avg(block, 'reviews').padStart(6)}   ${avg(block, 'backlog').padStart(6)}  ${avg(block, 'newWords').padStart(4)}  ${avg(block, 'reasks').padStart(6)}   ${avg(block, 'minutes').padStart(6)}   ${max}`);
  }
  const steady = rows.slice(300);
  console.log(`Days 301-450: ${avg(steady, 'reviews')} reviews, ${avg(steady, 'newWords')} new words and about ${avg(steady, 'minutes')} minutes a day.`);
  const progress = await store.allProgress();
  console.log(`After ${DAYS} days: ${progress.filter((p) => p.step >= 1).length} words learned, ${progress.filter((p) => p.step >= CONFIG.masteredStep).length} mastered.`);
});
