// Saved progress. Four stores:
//   progress  one record per word (see srs.js), keyed by word ID
//   events    a log of every answer, undo, check-in and badge, keyed by seq
//   days      one record per checked-in study day, keyed by day
//   meta      settings, earned badges and other single values, keyed by name
//
// Both stores below (MemoryStore for tests, IdbStore for the browser) offer the same
// async methods:
//   allProgress(), getProgress(id)
//   commit({ progress, remove, days, meta, removeEvents, removeDays, removeMeta, clear, event })
//     writes everything in one go and returns the event's seq. Every change goes with exactly
//     one event, so the log always explains the saved state. Inside the commit the stores
//     named in `clear` ('progress', 'events', 'days') are emptied first, then the deletes run
//     (word IDs in `remove`, seq numbers in `removeEvents`, study days in `removeDays`, meta
//     names in `removeMeta`), then the puts, and the event is added last.
//   eventsSince(seq)  events with a larger seq, oldest first (for the Sheet backup, Plan 5)
//   eventsFrom(day)   events of that study day and later, oldest first (for stats)
//   allEvents()       every event, oldest first (for counters, badges and going back to a day)
//   allDays(), getMeta(key), dump(), restore(dump)
// seq numbers start at 1 and only ever go up, also after a restore or a clear.
import { isDay } from './dates.js';

export const STORE_NAMES = Object.freeze(['progress', 'events', 'days', 'meta']);

const copy = (value) => (value === undefined ? undefined : structuredClone(value));

// A saved event never changes, so MemoryStore keeps each one frozen and allEvents() hands out
// the frozen events themselves. Copying tens of thousands of events at every session end made
// the 450-day simulation test take minutes. A caller that tries to change one gets a TypeError.
function frozen(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) frozen(v);
  }
  return value;
}

// Checks a commit before anything is written, so a bad commit changes nothing.
export const CLEARABLE = Object.freeze(['progress', 'events', 'days']);

export function checkCommit({
  progress = [], remove = [], days = [], meta = {}, removeEvents = [], removeDays = [], removeMeta = [], clear = [], event,
} = {}) {
  if (!event || typeof event.kind !== 'string' || !isDay(event.day)) {
    throw new Error('A commit needs an event with a kind and a study day');
  }
  if ('seq' in event) throw new Error('The store gives events their seq');
  for (const p of progress) {
    if (typeof p?.id !== 'string' || !Number.isInteger(p.step) || p.step < 0 || p.step > 9) {
      throw new Error(`Bad progress record ${JSON.stringify(p)}`);
    }
  }
  if (!remove.every((id) => typeof id === 'string')) throw new Error('remove takes word IDs');
  if (!days.every((d) => isDay(d?.day))) throw new Error('Bad day record');
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) throw new Error('meta must be an object');
  if (!removeEvents.every((s) => Number.isInteger(s) && s > 0)) throw new Error('removeEvents takes seq numbers');
  if (!removeDays.every(isDay)) throw new Error('removeDays takes study days');
  if (!removeMeta.every((k) => typeof k === 'string')) throw new Error('removeMeta takes meta names');
  if (!clear.every((name) => CLEARABLE.includes(name))) throw new Error('clear takes progress, events or days');
  return { progress, remove, days, meta, removeEvents, removeDays, removeMeta, clear, event };
}

function checkDump(dump) {
  for (const name of ['progress', 'events', 'days']) {
    if (!Array.isArray(dump?.[name])) throw new Error(`The backup has no ${name} list`);
  }
  if (typeof dump.meta !== 'object' || dump.meta === null) throw new Error('The backup has no meta');
  const seqs = dump.events.map((e) => e.seq);
  if (!seqs.every((s, i) => Number.isInteger(s) && s > 0 && (i === 0 || s > seqs[i - 1]))) {
    throw new Error('Backup events must have increasing seq numbers');
  }
}

const bySeq = (a, b) => a.seq - b.seq;
const byDay = (a, b) => a.day.localeCompare(b.day);

export class MemoryStore {
  constructor() {
    this.progress = new Map();
    this.events = [];
    this.days = new Map();
    this.meta = new Map();
    this.nextSeq = 1;
  }

  async allProgress() { return [...this.progress.values()].map(copy); }

  async getProgress(id) { return copy(this.progress.get(id)); }

  async commit(input) {
    const c = checkCommit(input);
    const seq = this.nextSeq;
    if (c.clear.includes('progress')) this.progress.clear();
    if (c.clear.includes('events')) this.events = [];
    if (c.clear.includes('days')) this.days.clear();
    for (const id of c.remove) this.progress.delete(id);
    if (c.removeEvents.length) {
      const gone = new Set(c.removeEvents);
      this.events = this.events.filter((e) => !gone.has(e.seq));
    }
    for (const day of c.removeDays) this.days.delete(day);
    for (const key of c.removeMeta) this.meta.delete(key);
    for (const p of c.progress) this.progress.set(p.id, copy(p));
    for (const d of c.days) this.days.set(d.day, copy(d));
    for (const [key, value] of Object.entries(c.meta)) this.meta.set(key, copy(value));
    this.events.push(frozen({ ...copy(c.event), seq }));
    this.nextSeq = seq + 1;
    return seq;
  }

  async eventsSince(seq) { return this.events.filter((e) => e.seq > seq).map(copy); }

  async allEvents() { return this.events.slice(); }

  async eventsFrom(day) { return this.events.filter((e) => e.day >= day).map(copy); }

  async allDays() { return [...this.days.values()].sort(byDay).map(copy); }

  async getMeta(key) { return copy(this.meta.get(key)); }

  async dump() {
    return copy({
      progress: [...this.progress.values()],
      events: this.events,
      days: [...this.days.values()].sort(byDay),
      meta: Object.fromEntries(this.meta),
    });
  }

  async restore(dump) {
    checkDump(dump);
    this.progress = new Map(dump.progress.map((p) => [p.id, copy(p)]));
    this.events = dump.events.map((e) => frozen(copy(e)));
    this.days = new Map(dump.days.map((d) => [d.day, copy(d)]));
    this.meta = new Map(Object.entries(copy(dump.meta)));
    this.nextSeq = Math.max(this.nextSeq, ...this.events.map((e) => e.seq + 1));
  }
}

// ---- IndexedDB (the browser's built-in database). Not run by the Node tests. ----

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function finished(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export function openIdbStore(name = 'hsk-flashcards', factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('progress', { keyPath: 'id' });
      db.createObjectStore('events', { keyPath: 'seq', autoIncrement: true }).createIndex('day', 'day');
      db.createObjectStore('days', { keyPath: 'day' });
      db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(new IdbStore(req.result));
    req.onerror = () => reject(req.error);
  });
}

export class IdbStore {
  constructor(db) { this.db = db; }

  async getAll(storeName, query) {
    return request(this.db.transaction(storeName).objectStore(storeName).getAll(query));
  }

  async allProgress() { return this.getAll('progress'); }

  async getProgress(id) { return request(this.db.transaction('progress').objectStore('progress').get(id)); }

  // clear() empties a store but does not reset its key generator, so the event added after a
  // clear still gets the next seq (tests/browser/store-idb.js checks this in Chrome).
  async commit(input) {
    const c = checkCommit(input);
    const tx = this.db.transaction(STORE_NAMES, 'readwrite');
    const done = finished(tx);
    for (const name of c.clear) tx.objectStore(name).clear();
    for (const id of c.remove) tx.objectStore('progress').delete(id);
    for (const seq of c.removeEvents) tx.objectStore('events').delete(seq);
    for (const day of c.removeDays) tx.objectStore('days').delete(day);
    for (const key of c.removeMeta) tx.objectStore('meta').delete(key);
    for (const p of c.progress) tx.objectStore('progress').put(p);
    for (const d of c.days) tx.objectStore('days').put(d);
    for (const [key, value] of Object.entries(c.meta)) tx.objectStore('meta').put({ key, value });
    const [seq] = await Promise.all([request(tx.objectStore('events').add({ ...c.event })), done]);
    return seq;
  }

  async eventsSince(seq) { return this.getAll('events', IDBKeyRange.lowerBound(seq, true)); }

  async allEvents() { return this.getAll('events'); }

  async eventsFrom(day) {
    const tx = this.db.transaction('events');
    const events = await request(tx.objectStore('events').index('day').getAll(IDBKeyRange.lowerBound(day)));
    return events.sort(bySeq);
  }

  async allDays() { return this.getAll('days'); }

  async getMeta(key) {
    const row = await request(this.db.transaction('meta').objectStore('meta').get(key));
    return row?.value;
  }

  async dump() {
    const [progress, events, days, meta] = await Promise.all(STORE_NAMES.map((n) => this.getAll(n)));
    return { progress, events, days, meta: Object.fromEntries(meta.map((m) => [m.key, m.value])) };
  }

  async restore(dump) {
    checkDump(dump);
    const tx = this.db.transaction(STORE_NAMES, 'readwrite');
    const done = finished(tx);
    for (const name of STORE_NAMES) tx.objectStore(name).clear();
    for (const p of dump.progress) tx.objectStore('progress').put(p);
    for (const e of dump.events) tx.objectStore('events').put(e);
    for (const d of dump.days) tx.objectStore('days').put(d);
    for (const [key, value] of Object.entries(dump.meta)) tx.objectStore('meta').put({ key, value });
    await done;
  }
}

// Asks the browser not to clear saved data when the phone runs low on space.
// Returns true when the data is protected.
export async function askPersistentStorage(nav = globalThis.navigator) {
  const storage = nav?.storage;
  if (!storage?.persist) return false;
  if (storage.persisted && (await storage.persisted())) return true;
  return storage.persist();
}
