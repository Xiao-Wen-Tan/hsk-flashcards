// Confetti for a check-in, made of small coloured pieces that fly up and fall, drawn with the
// browser's own animation function (element.animate) and no package. Nothing happens when the phone asks
// for reduced motion (prefers-reduced-motion), as the spec of 2026-10-03 asks for all motion.
import { THEME_COLORS } from '../view/format.js';

// Each piece's colour and flight, from random numbers between 0 and 1. With every number 0.5 a
// piece flies 200 px straight up without turning and starts after 75 ms.
export function confettiPieces(count, random = Math.random) {
  return Array.from({ length: count }, (_, i) => ({
    color: THEME_COLORS[i % THEME_COLORS.length],
    x: Math.round((random() - 0.5) * 300), // px sideways at the end of the flight
    y: Math.round(-120 - random() * 160), // px up at the top of the flight
    turn: Math.round((random() - 0.5) * 720), // degrees
    delay: Math.round(random() * 150), // ms
  }));
}

// True when the phone asks for less motion.
export function reducedMotion(win = globalThis) {
  return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

// Bursts `count` pieces from the middle of `el` and removes them after 2 seconds. Returns how
// many pieces it made, which is 0 with reduced motion.
export function burst(el, { reduced = reducedMotion(), count = 40, random = Math.random } = {}) {
  if (reduced || !el) return 0;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (const p of confettiPieces(count, random)) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.background = p.color;
    layer.append(piece);
    piece.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${p.x}px, ${p.y}px) rotate(${p.turn / 2}deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${Math.round(p.x * 1.3)}px, 220px) rotate(${p.turn}deg)`, opacity: 0 },
    ], { duration: 1400, delay: p.delay, easing: 'ease-out', fill: 'forwards' });
  }
  el.append(layer);
  setTimeout(() => layer.remove(), 2000);
  return count;
}
