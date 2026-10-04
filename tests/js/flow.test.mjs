// Plays whole study days the way the Session screen does. Each card goes through
// questionView, a tap is graded with gradeFor, and the grade goes to Plan 2's Study.
// No page is involved, so this checks the screen logic against the real controller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Study } from '../../docs/js/study.js';
import { MemoryStore } from '../../docs/js/store.js';
import { makePool } from '../../docs/js/distractors.js';
import { gradeFor, questionView } from '../../docs/js/view/quiz.js';
import { checkinView } from '../../docs/js/view/progress.js';
import { loadFixture, localDate, speakAll } from './helpers.mjs';

const data = loadFixture();
const pool = makePool(data.words);
const byId = new Map(data.words.map((w) => [w.id, w]));

// tap(view) returns the index of the choice to tap, or the recall grade.
async function playDay(store, day, tap) {
  const now = localDate(day);
  const study = await Study.start({ store, data, now });
  const kinds = [];
  while (!study.finished) {
    const card = study.card;
    const view = questionView({ card, word: byId.get(card.id), pool, day: study.day, step: study.byId.get(card.id)?.step ?? 0 });
    kinds.push(view.kind);
    if (view.kind === 'learn') { study.next(); continue; }
    if (view.kind === 'recall') { await study.answer(tap(view, card), now); continue; }
    assert.equal(view.choices.length, 4, `${card.type} ${card.id}`);
    assert.equal(view.hz, view.kind === 'listen' ? null : byId.get(card.id).hz, `${view.kind} ${card.id}`);
    await study.answer(gradeFor(view, tap(view, card)), now);
  }
  await speakAll(store, day, now);
  return { result: await study.finish(now), kinds };
}

const rightTap = (view) => (view.kind === 'recall' ? 'know' : view.answerIndex);

test('day 1 teaches 12 words through the screens and checks in', async () => {
  const store = new MemoryStore();
  const { result, kinds } = await playDay(store, '2026-10-05', rightTap);
  assert.deepEqual(kinds.filter((k) => k === 'learn').length, 12);
  assert.deepEqual(kinds.filter((k) => k === 'listen').length, 12); // one group check per word
  assert.deepEqual(kinds.filter((k) => k === 'pinyin').length, 12); // one final check per word
  const v = checkinView({ result, checkedDays: (await store.allDays()).map((d) => d.day), today: result.day, themes: data.themes });
  assert.equal(v.title, 'Checked in!');
  assert.deepEqual(v.lines, ['12 new words learned.']);
  assert.deepEqual(v.badges, ['10 words learned', '1 perfect day', 'Finished Starter Kit']);
});

test('day 2 starts with 12 listening reviews, and a wrong tap brings a recall card 4 cards later', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05', rightTap);
  let missed = null;
  const tapWrongOnce = (view, card) => {
    if (!missed && card.type === 'review') { missed = card.id; return (view.answerIndex + 1) % 4; }
    return rightTap(view);
  };
  const { kinds, result } = await playDay(store, '2026-10-06', tapWrongOnce);
  assert.deepEqual(kinds.slice(0, 4), ['listen', 'listen', 'listen', 'listen']);
  assert.equal(kinds[4], 'recall'); // the re-ask of the missed word
  assert.equal(result.checkedIn, true);
  assert.equal((await store.getProgress(missed)).lastGrade, 'wrong');
  // Next day the missed word's review is a recall card, as the design's quiz rule says.
  const study = await Study.start({ store, data, now: localDate('2026-10-07') });
  const card = study.state.cards.find((c) => c.id === missed);
  assert.equal(questionView({ card, word: byId.get(missed), pool, day: study.day, step: study.byId.get(missed).step }).kind, 'recall');
});
