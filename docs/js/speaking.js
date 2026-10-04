// The speaking panel's controller, the one place its screen (ui/speak.js) talks to. It holds the
// day's speaking list (speaklist.js), runs each word through its routine (speakflow.js), saves
// one speak event per finished word, and closes the day (closeday.js), so the day is checked in
// from whichever screen finishes last.
//
//   const speaking = await Speaking.start({ store, data, mode: 'tones' });
//   speaking.word            // the current word of the words file
//   speaking.state.phase     // 'listen', 'repeat', 'turn', ... (speakflow.js)
//   await speaking.send({ type: 'done' });   // after the screen played the word and the sentence
//   ...
//   const result = await speaking.close();   // closeDay's result, as { checkedIn, streak, ... }
import { studyDay } from './dates.js';
import { closeDay } from './closeday.js';
import { SPEAK_RESULTS, speakStatus, spokenWellBefore } from './speaklist.js';
import { next, startWord } from './speakflow.js';

// Saves one finished word as one event (speaking practice spec of 2026-10-03, section 5).
// check holds the numbers of the last try, never audio. Returns the event's seq.
export async function saveSpoken({ store, day, id, result, tries = 0, check = { tones: null, heard: null }, now = new Date() }) {
  if (!SPEAK_RESULTS.includes(result)) throw new Error(`Unknown speaking result ${result}`);
  return store.commit({ event: { day, kind: 'speak', id, result, tries, check, ts: now.toISOString() } });
}

export class Speaking {
  // mode says which checks run on this phone, 'one', 'twice', 'tones' or 'none' (speakflow.js).
  static async start({ store, data, now = new Date(), mode = 'tones' }) {
    const day = studyDay(now);
    const [progress, events] = await Promise.all([store.allProgress(), store.allEvents()]);
    const status = speakStatus({ progress, events, day });
    return new Speaking({ store, data, day, status, events, mode });
  }

  constructor({ store, data, day, status, events, mode }) {
    Object.assign(this, { store, data, day, mode });
    this.byId = new Map(data.words.map((w) => [w.id, w]));
    this.total = status.list.length;
    this.queue = status.left.slice();
    this.spokenWell = new Set(this.queue.filter((id) => spokenWellBefore(events, id, day)));
    this.counts = { pass: 0, skip: 0, listened: 0 };
    this.state = this.queue.length ? this.begin(this.queue[0]) : null;
  }

  begin(id) {
    return startWord({ id, spokenWell: this.spokenWell.has(id), mode: this.mode });
  }

  get word() { return this.state ? this.byId.get(this.state.id) : null; }

  get finished() { return this.queue.length === 0; }

  // How many words of the day's list are done, and how many it has.
  get position() { return { done: this.total - this.queue.length, total: this.total }; }

  // Changes the checks for the rest of the session, for example to 'tones' when the recognizer
  // failed, or to 'none' when the microphone was refused.
  async setMode(mode, now = new Date()) {
    this.mode = mode;
    return this.send({ type: 'mode', mode }, now);
  }

  // Sends one input to the current word's routine. When the word ends, it is saved and the next
  // word starts. Returns the finished word as { id, result, tries, check }, or null.
  // An input that arrives while a finished word is being saved (a second tap on Skip, or a late
  // sound) is dropped, as it belongs to the word being saved and not to the next one. When the
  // save fails, the word goes back to where it was, so it can be finished again.
  async send(input, now = new Date()) {
    if (!this.state || this.saving) return null;
    const before = this.state;
    this.state = next(this.state, input);
    if (this.state.phase !== 'done') return null;
    const { id, result, tries, check } = this.state;
    this.saving = true;
    try {
      await saveSpoken({ store: this.store, day: this.day, id, result, tries, check, now });
    } catch (err) {
      this.state = before;
      throw err;
    } finally {
      this.saving = false;
    }
    this.counts[result] += 1;
    this.queue.shift();
    this.state = this.queue.length ? this.begin(this.queue[0]) : null;
    return { id, result, tries, check };
  }

  // Closes the day, which is checked in when the learning and the speaking are both done, and
  // awards new badges. Returns closeDay's result with the counts of this session's words.
  async close(now = new Date()) {
    const result = await closeDay({ store: this.store, data: this.data, day: this.day, now });
    return { ...result, spoken: { ...this.counts } };
  }
}
