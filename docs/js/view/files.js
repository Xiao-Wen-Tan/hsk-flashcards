// Which audio and stroke files to keep on the phone. The design asks for today's and
// tomorrow's words at the start of a session, and for every file from Settings.
import { addDays } from '../dates.js';
import { nextNewWords } from '../curriculum.js';
import { learnedProgress } from '../srs.js';
import { charsOf, strokeUrl } from '../strokes.js';
import { AUDIO_BASE } from './card.js';

// The files of some words, each file once: word and sentence audio, then stroke data.
// For 苹果 in the fixture that is audio/w/w0026_6ce06b7e.mp3, audio/s/w0026_814ba0af.mp3,
// strokes/82f9.json and strokes/679c.json.
export function filesForWords(words) {
  const out = new Set();
  for (const w of words) {
    out.add(AUDIO_BASE + w.au);
    out.add(AUDIO_BASE + w.ex.au);
  }
  for (const w of words) for (const ch of charsOf(w.hz)) out.add(strokeUrl(ch));
  return [...out];
}

// Today's words and tomorrow's likely words: the words of today's plan, every word due by
// tomorrow, and the next new words after today's, as if today's new words were learned.
export function soonWords({ words, progress, plan, settings }) {
  const tomorrow = addDays(plan.day, 1);
  const ids = new Set([...plan.reviews, ...plan.newWords]);
  for (const p of progress) if (p.step >= 1 && p.due <= tomorrow) ids.add(p.id);
  const byId = new Map(progress.map((p) => [p.id, p]));
  for (const id of plan.newWords) byId.set(id, learnedProgress(id, plan.day));
  for (const id of nextNewWords(words, byId, settings.newPerDay, tomorrow)) ids.add(id);
  return words.filter((w) => ids.has(w.id));
}
