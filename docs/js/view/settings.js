// The Settings form and the backup file. No page access, so Node can test it.
import { CONFIG, normalizeSettings } from '../config.js';

// Values for the form. Auto-play is on unless the learner turned it off.
export function settingsView(saved) {
  const s = normalizeSettings(saved);
  return {
    newPerDay: s.newPerDay,
    reviewCap: s.reviewCap,
    autoplay: s.autoplay !== false,
    newRange: [CONFIG.newPerDayMin, CONFIG.newPerDayMax],
    capRange: [CONFIG.reviewCapMin, CONFIG.reviewCapMax],
  };
}

// The settings to save from the form's values, kept inside their ranges.
// settingsFromForm({ newPerDay: '50', reviewCap: '80', autoplay: false }, saved) gives
// newPerDay 30, reviewCap 80 and autoplay false, and keeps any other saved key.
export function settingsFromForm(form, saved = {}) {
  return normalizeSettings({
    ...saved, newPerDay: form.newPerDay, reviewCap: form.reviewCap, autoplay: Boolean(form.autoplay),
  });
}

export const BACKUP_APP = 'hsk-flashcards';

export function backupFileName(day) {
  return `hsk-flashcards-backup-${day}.json`;
}

// The text of a backup file, which is the store's dump plus a header that says what it is.
export function backupText(dump, { release, now = new Date() }) {
  return JSON.stringify({ app: BACKUP_APP, format: 1, release, exported: now.toISOString(), ...dump });
}

// Reads a backup file's text back into a dump for store.restore(). A file that is not a
// backup of this app gives an error with a plain message. store.restore checks the rest.
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('This file is not a backup file.');
  }
  if (obj?.app !== BACKUP_APP || obj.format !== 1) throw new Error('This file is not a backup of this app.');
  const { progress, events, days, meta } = obj;
  if (![progress, events, days].every(Array.isArray) || typeof meta !== 'object' || meta === null) {
    throw new Error('This backup file is damaged.');
  }
  return { dump: { progress, events, days, meta }, exported: obj.exported };
}
