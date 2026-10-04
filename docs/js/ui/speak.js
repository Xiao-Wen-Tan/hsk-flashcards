// The speaking panel ('#/speak'), a full screen without the bottom bar, like the study session.
// It asks the controller (speaking.js) for the current word and its phase, does what the phase
// asks (view/speak.js says what to show, speakflow.js effectsOf what to do), and sends back what
// happened, such as a sound that has played, a pause that is over, a tap on the microphone
// button, or the checks of a try.
import { Speaking } from '../speaking.js';
import { effectsOf, pauseMs } from '../speakflow.js';
import { trackPitch } from '../pitch.js';
import { addToVoice, emptyVoice, judgeTones } from '../tones.js';
import { fallbackMode, matchWord, readingsOf, recognizerOutcome } from '../speakcheck.js';
import { GOOGLE_NOTE, speakView } from '../view/speak.js';
import { closeMic, openMic, playSamples, recordTry } from './mic.js';
import { findMode, listen, saveMode } from './recognize.js';
import { h, show } from './dom.js';

// Two things are kept in this browser only. They are the learner's voice range (tones.js
// addToVoice, a count of pitch values, never a recording) and whether the Google note was seen.
const VOICE_KEY = 'hsk-voice';
const NOTE_KEY = 'hsk-speak-note';

function readStore(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode: nothing kept */ }
}
function loadVoice() {
  try { return JSON.parse(readStore(VOICE_KEY)) ?? emptyVoice(); } catch { return emptyVoice(); }
}

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Opens the panel, from Today or the check-in screen. The tap also lets Chrome play sound.
export async function startSpeaking(app) {
  app.player.stop();
  let mode = findMode();
  const permission = await navigator.permissions?.query({ name: 'microphone' }).catch(() => null);
  if (permission?.state === 'denied') mode = 'none';
  saveMode(mode);
  app.readings = app.readings ?? readingsOf(app.data.words);
  app.lastVoice = null;
  app.speaking = await Speaking.start({ store: app.store, data: app.data, mode });
  window.location.hash = '#/speak';
}

// Ends the panel, finished or not, closes the day (the check-in when the learning is done too)
// and shows the check-in screen unless `quiet`.
export async function endSpeaking(app, { quiet = false } = {}) {
  const speaking = app.speaking;
  if (!speaking) return;
  app.speaking = null;
  app.speakRun = (app.speakRun ?? 0) + 1;
  app.player.stop();
  app.stopTry?.();
  const result = await speaking.close();
  app.lastResult = result;
  await app.hooks.emit('sessionEnd', { store: app.store, result });
  if (!quiet) window.location.hash = '#/checkin';
}

// Plays one sound once. Resolves 'done', or 'stopped' when the phone wants a tap first (the
// "Tap to continue" screen then starts the phase again) or the sound was cut short.
async function playOnce(app, url) {
  try {
    return await app.player.play(url, 1);
  } catch (err) {
    if (err && err.name === 'NotAllowedError') {
      app.needTap(() => renderSpeak(app));
      return 'stopped';
    }
    app.note('Sound is not on this phone yet. It plays when the phone is online.');
    return 'done';
  }
}

function draw(app, flash = null) {
  const speaking = app.speaking;
  const v = speakView({ word: speaking.word, state: speaking.state, position: speaking.position });
  const needNote = v.mic && ['one', 'twice'].includes(speaking.state.mode) && readStore(NOTE_KEY) !== 'seen';
  const micButton = h('button', {
    class: 'mic',
    disabled: needNote,
    'aria-label': 'Microphone: tap and say the word',
    onclick: () => advance(app, { type: 'tap' }),
  }, 'Tap and say it');
  show(app.main,
    h('div', { class: 'session-top' },
      h('button', {
        class: 'small',
        onclick: () => { if (window.confirm('Stop for now? The words finished so far are saved.')) endSpeaking(app); },
      }, 'Stop'),
      h('span', { class: 'muted' }, v.progress),
      h('button', { class: 'small', onclick: () => advance(app, { type: 'skip' }) }, 'Skip')),
    h('section', { class: 'card speak-card' },
      h('div', { class: 'hz speak-hz', lang: 'zh-CN' }, v.hz),
      h('div', { class: 'py' }, v.py),
      h('div', { class: 'en' }, v.en),
      h('div', { class: 'example' },
        h('div', { class: 'ex-hz', lang: 'zh-CN' }, v.sentence.map((p) => (p.hl ? h('mark', {}, p.text) : p.text))),
        h('div', { class: 'ex-py' }, v.sentencePy),
        h('div', { class: 'ex-en' }, v.sentenceEn))),
    flash ? h('div', { class: `banner ${flash.right ? 'right' : 'wrong'}` }, flash.text) : null,
    h('h2', { class: 'speak-heading' }, v.heading, v.counter ? h('span', { class: 'counter' }, ` ${v.counter}`) : null),
    h('p', { class: 'prompt' }, v.prompt),
    v.problems.map((p) => h('p', { class: 'problem' }, p)),
    needNote ? h('div', { class: 'note' }, h('p', {}, GOOGLE_NOTE),
      h('button', { class: 'small', onclick: () => { writeStore(NOTE_KEY, 'seen'); draw(app); } }, 'OK')) : null,
    v.mic ? micButton : null,
    v.listening ? h('div', { class: 'meter' }, h('span', { class: 'meter-level' })) : null,
    h('div', { class: 'row' },
      h('button', { class: 'small', onclick: () => playOnce(app, v.wordAudio) }, 'Play the word'),
      app.lastVoice ? h('button', { class: 'small', onclick: () => playSamples(app.lastVoice) }, 'Play my voice') : null));
}

function meter(app, level) {
  const bar = app.main.querySelector('.meter-level');
  if (bar) bar.style.width = `${Math.min(100, Math.round(level * 400))}%`;
}

// Sends one input to the controller and draws what follows. A finished word gets a short
// message before the next word. A save that fails (the store, for example, could not write)
// is shown as a note, and the panel is redrawn on the word as it was, so it is not left
// waiting (speaking.js send() restores the word's state on a failed save).
async function advance(app, input) {
  const speaking = app.speaking;
  if (!speaking || app.busy) return;
  app.busy = true;
  app.speakRun = (app.speakRun ?? 0) + 1;
  app.player.stop();
  app.stopTry?.();
  let finished;
  try {
    finished = await speaking.send(input);
  } catch (err) {
    app.note(err.message);
    renderSpeak(app);
    return;
  } finally {
    app.busy = false;
  }
  if (finished && finished.result !== 'listened' && app.speaking === speaking && !speaking.finished) {
    const text = finished.result === 'pass' ? 'Well said!' : 'Skipped. It comes back next time.';
    app.speakRun += 1;
    const run = app.speakRun;
    draw(app, { right: finished.result === 'pass', text });
    await wait(900);
    if (app.speakRun !== run) return;
  }
  renderSpeak(app);
}

// The 'record' phase makes one recording for the tone check, and for the sound check too when the
// recognizer can listen to the same microphone (mode 'one').
async function recordAndCheck(app, withSounds, alive) {
  const speaking = app.speaking;
  const word = speaking.word;
  let stream;
  try {
    stream = await openMic();
  } catch {
    saveMode('none');
    try {
      await speaking.setMode('none');
    } catch (err) {
      app.note(err.message);
      renderSpeak(app);
      return;
    }
    renderSpeak(app);
    return;
  }
  const recognizer = withSounds ? listen({ track: stream.getAudioTracks()[0] }) : null;
  const recording = recordTry(stream, { onLevel: (level) => meter(app, level) });
  app.stopTry = recording.stop;
  const audio = await recording.done;
  recognizer?.stop();
  const heard = recognizer ? await recognizer.done : null;
  closeMic(stream);
  app.stopTry = null;
  if (!alive()) return;
  app.lastVoice = audio.voice ? audio : null;
  // The recognizer failing, or missing a voice twice in a row, changes the checking method:
  // from one shared recording to saying the word twice, or else to the tone check alone.
  const outcome = recognizerOutcome(heard, audio.voice);
  app.missedVoice = outcome === 'empty' ? (app.missedVoice ?? 0) + 1 : 0;
  if (outcome === 'failed' || app.missedVoice >= 2) {
    const next = fallbackMode(speaking.mode, outcome === 'failed' ? heard.error : null);
    app.missedVoice = 0;
    saveMode(next);
    try {
      await speaking.setMode(next);
    } catch (err) {
      app.note(err.message);
      renderSpeak(app);
      return;
    }
  }
  const sounds = outcome === 'heard' ? matchWord(word, heard.texts, app.readings) : null;
  const track = trackPitch(audio.samples, audio.rate);
  const voice = loadVoice();
  const tones = judgeTones({ track, word, voice, strictness: (await app.settings()).speakStrictness });
  if (audio.voice) writeStore(VOICE_KEY, JSON.stringify(addToVoice(voice, track.f0)));
  await advance(app, { type: 'heard', tones, sounds });
}

// In the 'sounds' phase of mode 'twice' the recognizer listens alone, and the recording follows.
async function soundsFirst(app, alive) {
  const speaking = app.speaking;
  const heard = await listen().done;
  if (!alive()) return;
  if (heard.error && heard.error !== 'no-speech') {
    saveMode('tones');
    try {
      await speaking.setMode('tones');
    } catch (err) {
      app.note(err.message);
      renderSpeak(app);
      return;
    }
    renderSpeak(app);
    return;
  }
  await advance(app, { type: 'heard', sounds: matchWord(speaking.word, heard.texts, app.readings) });
}

// Draws the current word and carries out its phase.
export async function renderSpeak(app) {
  const speaking = app.speaking;
  if (!speaking) {
    window.location.hash = '#/today';
    return;
  }
  if (speaking.finished) {
    endSpeaking(app);
    return;
  }
  app.speakRun = (app.speakRun ?? 0) + 1;
  const run = app.speakRun;
  const alive = () => app.speaking === speaking && app.speakRun === run;
  draw(app);
  const v = speakView({ word: speaking.word, state: speaking.state, position: speaking.position });
  for (const fx of effectsOf(speaking.state)) {
    if (!alive()) return;
    if (fx.type === 'play') {
      const started = performance.now();
      const how = await playOnce(app, fx.what === 'word' ? v.wordAudio : v.sentenceAudio);
      if (how === 'stopped') return;
      if (fx.what === 'word') app.wordSeconds = (performance.now() - started) / 1000;
    } else if (fx.type === 'pause') {
      await wait(pauseMs(app.wordSeconds ?? 1));
    } else if (fx.type === 'listen') {
      await soundsFirst(app, alive);
      return;
    } else if (fx.type === 'record') {
      await recordAndCheck(app, fx.sounds, alive);
      return;
    }
  }
  if (alive() && ['listen', 'repeat', 'missed'].includes(speaking.state.phase)) await advance(app, { type: 'done' });
}
