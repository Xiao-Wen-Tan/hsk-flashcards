import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goals, nearest } from '../../docs/js/goals.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const learned = (words) => new Map(words.map((w) => [w.id, learnedProgress(w.id, '2026-10-01')]));
// The 12 Starter Kit words and the first 2 of Greetings & Courtesy (10 words) are learned.
const t02 = data.words.filter((w) => w.theme === 't02');
const progressById = learned([...data.words.filter((w) => w.theme === 't01'), ...t02.slice(0, 2)]);
const facts = { bestStreak: 27, learned: 14, totalWords: 61, reviews: 95, minutes: 52.5, spokenWell: 4 };

test('every countdown says how far the next milestone is, in its own unit, nearest first', () => {
  const list = goals({ data, progressById, facts, streak: 27 });
  assert.deepEqual(list.map((g) => [g.id, g.text, g.left]), [
    ['reviews', '5 reviews to the 100-review badge', 5],
    ['streak', '3 days to the 30-day badge', 3],
    ['minutes', '8 minutes to the 60-minute badge', 8],
    ['learned', '11 more words to the 25-word badge', 11],
    ['spoken', '6 more words to say well for the 10-word speaking badge', 6],
    ['group', '47 more words to finish HSK 1-2', 47],
    ['theme', '8 more words to finish Greetings & Courtesy', 8],
  ]);
  // The share left to go is 5 of 100 reviews, 3 of 30 days, and so on up to 8 of the tile's 10 words.
  assert.deepEqual(list.map((g) => Math.round(g.share * 100)), [5, 10, 13, 44, 60, 77, 80]);
});

test('Today shows the two nearest', () => {
  const list = goals({ data, progressById, facts, streak: 27 });
  assert.deepEqual(nearest(list, 2).map((g) => g.id), ['reviews', 'streak']);
  assert.deepEqual(nearest([{ id: 'a', share: 0.5 }, { id: 'b', share: 0.2 }], 1), [{ id: 'b', share: 0.2 }]);
});

test('a broken streak counts the whole run again, and the last words aim at every word', () => {
  const list = goals({ data, progressById: learned(data.words.slice(0, 55)), facts: { ...facts, learned: 55 }, streak: 0 });
  const byId = Object.fromEntries(list.map((g) => [g.id, g]));
  assert.equal(byId.streak.text, '30 days to the 30-day badge');
  assert.equal(byId.learned.text, '6 more words to learn every word');
  assert.equal(byId.group.text, '6 more words to finish HSK 1-2');
});

test('a goal with nothing left is not shown', () => {
  const done = goals({
    data, progressById: learned(data.words), facts: { bestStreak: 365, learned: 61, totalWords: 61, reviews: 10000, minutes: 3000, spokenWell: 1000 }, streak: 365,
  });
  assert.deepEqual(done, []);
  const reviews = (n) => goals({ data, progressById, facts: { ...facts, reviews: n }, streak: 27 }).find((g) => g.id === 'reviews').text;
  assert.equal(reviews(1), '99 reviews to the 100-review badge');
  assert.equal(reviews(99), '1 review to the 100-review badge');
  assert.equal(reviews(100), '900 reviews to the 1,000-review badge');
});
