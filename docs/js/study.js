// Study is the one place the screens (Plan 4) talk to. It plans the day, runs a session,
// saves every answer, handles Undo, and at the end closes the day (closeday.js), which checks in
// and awards badges.
// Every answer also saves the session itself (meta 'session'), so a session that is stopped,
// closed or reloaded continues after its last answer on the same study day. Without it the
// new words would start again from their learning cards, because a new word's record is only
// written at its final check.
//
//   const study = await Study.start({ store, data });   // data = the words JSON
//   while (!study.finished) {
//     if (study.card.type === 'learn') study.next();
//     else await study.answer('right');                 // or 'wrong', 'know', 'unsure', 'dontknow'
//   }
//   const result = await study.finish();                 // { checkedIn, streak, newBadges, ... }
import { normalizeSettings } from './config.js';
import { studyDay } from './dates.js';
import { planDay } from './plan.js';
import {
  advance, answerCard, canUndo, createSession, currentCard, isFinished, sessionLeft, sessionSummary, undoAnswer,
} from './session.js';
import { PASS } from './srs.js';
import { closeDay } from './closeday.js';

export async function loadSettings(store) {
  return normalizeSettings(await store.getMeta('settings'));
}

// What today holds, for the Today screen, without starting a session.
export async function previewDay({ store, data, now = new Date() }) {
  const settings = await loadSettings(store);
  return planDay({ words: data.words, progress: await store.allProgress(), today: studyDay(now), settings });
}

// The session saved with the last answer, when it is from the plan's day, not finished, and
// still fits the plan. After the daily amounts are lowered, for example new words from 12 to 4,
// the stopped session's 12 words no longer fit, and Start plans a fresh session of 4.
async function savedSession(store, plan) {
  const saved = await store.getMeta('session');
  if (!saved || saved.day !== plan.day || isFinished(saved.state)) return null;
  const left = sessionLeft(saved.state);
  const fits = left.reviews.every((id) => plan.reviews.includes(id))
    && left.newWords.every((id) => plan.newWords.includes(id));
  return fits ? saved.state : null;
}

// True when Start would continue a session stopped earlier today.
export async function canContinue({ store, data, now = new Date() }) {
  return (await savedSession(store, await previewDay({ store, data, now }))) !== null;
}

// The session as it is saved: without the copy kept for Undo.
const toSave = (day, state) => ({ day, state: { ...state, prev: null } });

export class Study {
  static async start({ store, data, now = new Date() }) {
    const settings = await loadSettings(store);
    const day = studyDay(now);
    const progress = await store.allProgress();
    const byId = new Map(progress.map((p) => [p.id, p]));
    const plan = planDay({ words: data.words, progress, today: day, settings });
    const saved = await savedSession(store, plan);
    if (saved) return new Study({ store, data, settings, day, plan: { ...plan, ...sessionLeft(saved) }, byId, state: saved });
    return new Study({ store, data, settings, day, plan, byId, state: createSession(plan, byId) });
  }

  constructor({ store, data, settings, day, plan, byId, state }) {
    Object.assign(this, { store, data, settings, day, plan, byId, state });
    this.last = null; // { seq, event } of the last saved answer, for Undo
  }

  get card() { return currentCard(this.state); }

  get finished() { return isFinished(this.state); }

  get canUndo() { return this.last !== null && canUndo(this.state); }

  // Leave a learning card.
  next() {
    this.state = advance(this.state);
  }

  // Save one answer. Returns { pass, seq }.
  async answer(grade, now = new Date()) {
    const out = answerCard(this.state, grade, this.byId);
    const before = this.byId.get(out.event.id) ?? null;
    const event = { ...out.event, ts: now.toISOString(), before, after: out.progress };
    const seq = await this.store.commit({
      progress: out.progress ? [out.progress] : [], meta: { session: toSave(this.day, out.state) }, event,
    });
    if (out.progress) this.byId.set(out.progress.id, out.progress);
    this.state = out.state;
    this.last = { seq, event };
    return { pass: PASS.has(grade), seq };
  }

  // Undo takes back the last answer. The word's record goes back to what it was, and an
  // undo event names the answer it cancels.
  async undo(now = new Date()) {
    if (!this.canUndo) throw new Error('Nothing to undo');
    const { seq, event } = this.last;
    const changed = event.after !== null;
    const state = undoAnswer(this.state);
    await this.store.commit({
      progress: changed && event.before ? [event.before] : [],
      remove: changed && !event.before ? [event.id] : [],
      meta: { session: toSave(this.day, state) },
      event: { day: this.day, kind: 'undo', target: seq, id: event.id, ts: now.toISOString() },
    });
    if (changed && event.before) this.byId.set(event.id, event.before);
    if (changed && !event.before) this.byId.delete(event.id);
    this.state = state;
    this.last = null;
  }

  // End the session (finished or not). closeDay checks in when nothing is left for the day and
  // awards any new badges. The result adds the session's summary for the check-in screen.
  async finish(now = new Date()) {
    const summary = sessionSummary(this.state);
    const result = await closeDay({
      store: this.store, data: this.data, day: this.day, settings: this.settings, now, perfectSession: summary.perfect,
    });
    return { ...result, summary };
  }
}
