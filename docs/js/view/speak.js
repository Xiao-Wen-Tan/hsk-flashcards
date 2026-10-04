// What the speaking panel shows (ui/speak.js draws it), and the speaking lines of Today and
// Settings. It never touches the page, so Node tests it.
import { AUDIO_BASE, highlightParts } from './card.js';
import { plural } from './format.js';
import { ROUNDS } from '../speakflow.js';

// The line in Settings that says which checks work on this phone. mode is what ui/recognize.js
// found the first time the panel was used, or null before that.
export function checkText(mode) {
  const lines = {
    one: 'sounds and tones.',
    twice: 'sounds and tones, saying each word twice.',
    tones: 'tones only. The sound check needs Chrome\'s speech recognition and the internet.',
    none: 'none, because the microphone is not allowed. Words are listened to and repeated.',
  };
  return `Speaking check on this phone: ${lines[mode] ?? 'not tried yet. Open speaking practice once to find out.'}`;
}

// The one-time note before the first try, also shown in Settings and on the credits page.
// True when opening the microphone failed because it is refused or missing, so the panel goes
// on with listening only. A busy microphone (NotReadableError, for example during a call or
// while Chrome's recognizer still holds it) is not refused, and the learner can try again.
const MIC_REFUSED = ['NotAllowedError', 'SecurityError', 'NotFoundError', 'TypeError'];
export function micRefused(err) {
  return MIC_REFUSED.includes(err?.name);
}

export const MIC_BUSY = 'The microphone is busy, for example during a call. Tap the microphone again in a moment.';

export const GOOGLE_NOTE = 'The sound check uses Google\'s speech recognition in Chrome, which sends your voice to Google. '
  + 'This app never saves your recordings.';

// The "Speaking practice" button of Today, under Start or Continue. speak is the day's speaking
// list as speakStatus (speaklist.js) gives it.
//   { list: 18 IDs, done: [], left: 18 IDs } gives { enabled: true, count: '18 words to speak' }
export function speakButton(speak) {
  const left = speak.left.length;
  let count;
  if (left) count = `${plural(left, 'word')} to speak`;
  else if (speak.list.length === 1) count = 'The word is spoken.';
  else if (speak.list.length) count = `All ${plural(speak.list.length, 'word')} spoken.`;
  else count = 'No words to speak yet. Study first.';
  return { label: 'Speaking practice', count, enabled: left > 0 };
}

const HEADINGS = {
  listen: 'Listen',
  repeat: 'Repeat after me',
  turn: 'Your turn',
  sounds: 'Say the word',
  record: 'Say the word',
  missed: 'Not quite',
};

// The screen of one word. word is the words file's word, state the routine's state
// (speakflow.js) and position the controller's { done, total }.
//   phase 'repeat', round 2 gives heading 'Repeat after me', counter '2 of 3'
export function speakView({ word, state, position }) {
  const view = {
    progress: `Word ${position.done + 1} of ${position.total}`,
    hz: word.hz,
    py: word.py,
    en: word.enShort,
    wordAudio: AUDIO_BASE + word.au,
    sentence: highlightParts(word.ex.hz, word.hz),
    sentencePy: word.ex.py,
    sentenceEn: word.ex.en,
    sentenceAudio: AUDIO_BASE + word.ex.au,
    heading: HEADINGS[state.phase] ?? '',
    counter: state.phase === 'repeat' ? `${state.round} of ${ROUNDS}` : null,
    prompt: '',
    problems: state.phase === 'missed' || (state.phase === 'turn' && state.tries > 0) ? state.problems : [],
    mic: state.phase === 'turn',
    // "Play the word" and "Play my voice" work only while the routine waits for the learner, in
    // 'turn' (also the screen after a miss, before the next try). In the other phases a sound
    // plays or the microphone is open, and a replay would cut that sound short or be recorded.
    replay: state.phase === 'turn',
    listening: state.phase === 'sounds' || state.phase === 'record',
    tries: state.tries,
  };
  if (state.phase === 'listen') view.prompt = 'Listen to the word and its example sentence.';
  if (state.phase === 'repeat') view.prompt = 'Say it after the voice. Nothing is recorded.';
  if (state.phase === 'turn') view.prompt = state.tries ? 'Try again. Tap the microphone and say the word.' : 'Tap the microphone and say the word.';
  if (state.phase === 'sounds') view.prompt = 'Say it now, for the sound check.';
  if (state.phase === 'record') view.prompt = state.mode === 'twice' ? 'Now say it once more, for the tone check.' : 'Listening...';
  if (state.phase === 'missed') view.prompt = 'Listen again.';
  return view;
}

// The line of the check-in screen about speaking, from the panel's counts of this session.
//   { pass: 11, listened: 0, skip: 1 } gives '11 said well and 1 skipped in speaking practice.'
export function spokenLine(spoken) {
  const parts = [];
  if (spoken.pass) parts.push(`${spoken.pass} said well`);
  if (spoken.listened) parts.push(`${spoken.listened} listened to`);
  if (spoken.skip) parts.push(`${spoken.skip} skipped`);
  if (!parts.length) return null;
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return `${joined} in speaking practice.`;
}
