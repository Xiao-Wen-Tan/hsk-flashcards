import { test } from 'node:test';
import assert from 'node:assert/strict';
import { burst, confettiPieces, reducedMotion } from '../../docs/js/ui/confetti.js';
import { THEME_COLORS } from '../../docs/js/view/format.js';

test('each piece gets a colour of the themes and a flight from the random numbers', () => {
  const pieces = confettiPieces(7, () => 0.5);
  assert.equal(pieces.length, 7);
  assert.deepEqual(pieces.map((p) => p.color), [...THEME_COLORS, THEME_COLORS[0]]);
  // With every random number 0.5, a piece flies straight up 200 px, without turning, after 75 ms.
  assert.deepEqual(pieces[0], { color: THEME_COLORS[0], x: 0, y: -200, turn: 0, delay: 75 });
  const low = confettiPieces(1, () => 0)[0];
  assert.deepEqual([low.x, low.y, low.turn, low.delay], [-150, -120, -360, 0]);
});

test('no confetti when the phone asks for reduced motion', () => {
  assert.equal(reducedMotion({ matchMedia: (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' }) }), true);
  assert.equal(reducedMotion({ matchMedia: () => ({ matches: false }) }), false);
  assert.equal(reducedMotion({}), false);
  assert.equal(burst({}, { reduced: true }), 0);
  assert.equal(burst(null, { reduced: false }), 0);
});
