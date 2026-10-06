// The routine for one word of the speaking panel (speaking practice spec of 2026-10-03,
// section 3), as a small state machine. It never touches the page, so Node tests every path.
// The screen (ui/speak.js) carries out the `effects` of each phase, then sends an input back.
//
// The phases:
//   listen   the word plays, then its example sentence once        effects: play word, play sentence
//   repeat   round 1 to 3, the word plays and a pause follows,       effects: play word, pause
//            for the learner to say it
//   turn     "Your turn", which waits for the microphone button     effects: none
//   sounds   the first time in say-it-twice mode, for the recognizer effects: listen
//   record   the recording for the tone check (and the recognizer,  effects: record
//            when it shares the microphone)
//   missed   what was wrong is shown, and the word plays again      effects: play word
//   done     the word is finished                                   effects: finish
//
// The modes say which checks run on this phone (ui/recognize.js finds out):
//   one    both checks from one recording
//   twice  both checks, with the word said twice, first for the recognizer
//   tones  the tone check alone (offline, or the recognizer failed)
//   none   without a microphone the word is listened to and repeated, and ends as 'listened'
//
// A new word goes listen, repeat 1, 2, 3, turn. A word spoken well on an earlier day starts at
// turn, and its first miss runs listen and repeat before the next try. Skip ends any phase.
//   let s = startWord({ id: 'w0003', spokenWell: false, mode: 'tones' });   // phase 'listen'
//   s = next(s, { type: 'done' });                                            // phase 'repeat', round 1
import { verdict } from './speakcheck.js';

export const ROUNDS = 3;
export const MODES = Object.freeze(['one', 'twice', 'tones', 'none']);

// The pause after a word in the repeat rounds, 1.5 times the length of its sound plus 1 second.
// A word that plays for 0.8 seconds gives 2,200 ms.
export function pauseMs(seconds) {
  return Math.round(1500 * seconds + 1000);
}

export function startWord({ id, spokenWell = false, mode = 'tones' }) {
  const atTurn = spokenWell && mode !== 'none';
  return {
    id, mode, phase: atTurn ? 'turn' : 'listen', round: 0, tries: 0, repeated: !atTurn, startedAtTurn: atTurn,
    sounds: null, problems: [], check: { tones: null, heard: null }, result: null,
  };
}

const finish = (s, result) => ({ ...s, phase: 'done', result });
const listenAgain = (s) => ({ ...s, phase: 'listen', round: 0, repeated: true });

// The state after one input. The inputs are
//   { type: 'done' }                  the effects of the phase have finished
//   { type: 'tap' }                   the microphone button, in 'turn'
//   { type: 'heard', sounds, tones }  the checks of a recording, as matchWord() and judgeTones()
//                                     give them (only sounds in the 'sounds' phase), either may be null
//   { type: 'busy', problem }         the microphone could not be opened for the recording, so the
//                                     try did not happen; `problem` is shown and the word plays again
//   { type: 'mode', mode }            the checks changed, for example to 'tones' when the recognizer
//                                     failed, or to 'none' when the microphone was refused
//   { type: 'skip' }                  the Skip button
export function next(s, input) {
  if (s.phase === 'done') return s;
  if (input.type === 'skip') return finish(s, 'skip');
  if (input.type === 'mode') {
    const changed = { ...s, mode: input.mode };
    if (input.mode !== 'none') return s.phase === 'sounds' && input.mode !== 'twice' ? { ...changed, phase: 'record' } : changed;
    if (s.phase === 'listen' || s.phase === 'repeat') return changed;
    return s.repeated && s.round >= ROUNDS ? finish(changed, 'listened') : listenAgain(changed);
  }
  switch (s.phase) {
    case 'listen':
      return input.type === 'done' ? { ...s, phase: 'repeat', round: 1 } : s;
    case 'repeat':
      if (input.type !== 'done') return s;
      if (s.round < ROUNDS) return { ...s, round: s.round + 1 };
      return s.mode === 'none' ? finish(s, 'listened') : { ...s, phase: 'turn' };
    case 'turn':
      if (input.type !== 'tap') return s;
      return { ...s, phase: s.mode === 'twice' ? 'sounds' : 'record', sounds: null };
    case 'sounds':
      return input.type === 'heard' ? { ...s, phase: 'record', sounds: input.sounds ?? null } : s;
    case 'record': {
      // A busy microphone is not a try. In mode 'twice' the sound check's answer is dropped too,
      // so the word cannot pass on the sound check alone, and both are asked for again.
      if (input.type === 'busy') return { ...s, phase: 'missed', problems: [input.problem], sounds: null };
      if (input.type !== 'heard') return s;
      const sounds = s.mode === 'twice' ? s.sounds : input.sounds ?? null;
      const v = verdict({ tones: input.tones ?? null, sounds: s.mode === 'tones' ? null : sounds });
      const tried = { ...s, tries: s.tries + 1, check: v.check, problems: v.problems, sounds: null };
      return v.pass ? finish(tried, 'pass') : { ...tried, phase: 'missed' };
    }
    case 'missed':
      if (input.type !== 'done') return s;
      return s.startedAtTurn && !s.repeated && s.tries > 0 ? listenAgain(s) : { ...s, phase: 'turn' };
    default:
      return s;
  }
}

// What the screen does in a phase, in order.
export function effectsOf(s) {
  switch (s.phase) {
    case 'listen': return [{ type: 'play', what: 'word' }, { type: 'play', what: 'sentence' }];
    case 'repeat': return [{ type: 'play', what: 'word' }, { type: 'pause' }];
    case 'sounds': return [{ type: 'listen' }];
    case 'record': return [{ type: 'record', sounds: s.mode === 'one' }];
    case 'missed': return [{ type: 'play', what: 'word' }];
    case 'done': return [{ type: 'finish', result: s.result, tries: s.tries, check: s.check }];
    default: return [];
  }
}
