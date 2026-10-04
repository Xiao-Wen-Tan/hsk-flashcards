// Chrome's speech recognizer for the sound check of the speaking panel. It sends the voice to
// Google, so it works only online, and the panel says so once (view/speak.js GOOGLE_NOTE).
//
// Which checks run on this phone (the modes of speakflow.js):
//   one    the recognizer can listen to the panel's own microphone track (Chrome 135 and
//          later), so one recording feeds both checks
//   twice  the recognizer opens the microphone itself, so the learner says the word twice,
//          first for the recognizer, then for the recording of the tone check
//   tones  the tone check alone, when there is no recognizer or the phone is offline
// The mode found is kept in this browser (localStorage) for the line in Settings.
export const CHECK_KEY = 'hsk-speak-check';

const Recognition = () => globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;

// True when the recognizer takes a microphone track. Such a recognizer refuses anything that
// is not a track with a TypeError, while an older one ignores the argument and starts
// listening, which is stopped at once.
export function sharesMic() {
  const R = Recognition();
  if (!R) return false;
  const r = new R();
  try {
    r.start(null);
  } catch (err) {
    return err instanceof TypeError;
  }
  try { r.abort(); } catch { /* already stopped */ }
  return false;
}

// The mode for a new panel session.
export function findMode({ online = navigator.onLine } = {}) {
  if (!Recognition() || !online) return 'tones';
  return sharesMic() ? 'one' : 'twice';
}

export function savedMode(storage = globalThis.localStorage) {
  try { return storage.getItem(CHECK_KEY); } catch { return null; }
}

export function saveMode(mode, storage = globalThis.localStorage) {
  try { storage.setItem(CHECK_KEY, mode); } catch { /* private mode: only Settings misses it */ }
}

// Listens for one word, in Chinese, from `track` or else from the microphone the recognizer
// opens itself. Returns { done, stop }. done resolves { texts, error }, where texts are the
// recognizer's guesses, best first, and error is null, 'no-speech' (it heard nothing), or
// another error such as 'network' or 'not-allowed', after which the panel uses the tone check
// alone. stop() ends the listening, as when the recording has ended.
export function listen({ track = null, lang = 'zh-CN', alternatives = 5, timeoutMs = 10000 } = {}) {
  const R = Recognition();
  if (!R) return { done: Promise.resolve({ texts: [], error: 'no-recognizer' }), stop: () => {} };
  const r = new R();
  r.lang = lang;
  r.maxAlternatives = alternatives;
  r.interimResults = false;
  r.continuous = false;
  let texts = [];
  let error = null;
  let timer;
  const done = new Promise((resolve) => {
    const end = () => { clearTimeout(timer); resolve({ texts, error }); };
    r.onresult = (e) => { texts = [...e.results[0]].map((alt) => alt.transcript); };
    r.onerror = (e) => { error = e.error; };
    r.onend = end;
    timer = setTimeout(() => {
      error = error ?? 'timeout';
      try { r.abort(); } catch { /* ended */ }
      end();
    }, timeoutMs);
    try {
      if (track) r.start(track);
      else r.start();
    } catch (err) {
      error = 'start-failed';
      end();
    }
  });
  return { done, stop: () => { try { r.stop(); } catch { /* ended */ } } };
}
