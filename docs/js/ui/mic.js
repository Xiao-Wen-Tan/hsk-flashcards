// The microphone of the speaking panel. Each try opens the microphone, records until the
// learner has spoken and stopped, and closes it again, so the phone's microphone light goes off
// between tries. A recording stays in memory for "Play my voice" and is never saved.
//
// Raw samples come from an audio worklet (mic-worklet.js). Where the phone has none, the
// browser's recorder (MediaRecorder) records the try and decodeAudioData turns it into samples.
// Both ways, a level meter decides when to stop. After the voice started, 0.7 seconds of quiet
// end the try. With no voice after 4 seconds, or after 6 seconds in all, the try ends anyway.
const WORKLET_URL = new URL('./mic-worklet.js', import.meta.url);

// Opens the microphone. Rejects with NotAllowedError when the learner or the phone refuses it.
export function openMic() {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
  });
}

export function closeMic(stream) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

const rms = (block) => {
  let sum = 0;
  for (let i = 0; i < block.length; i += 1) sum += block[i] * block[i];
  return Math.sqrt(sum / Math.max(1, block.length));
};

// Decides when a try is over, from the loudness of each block of sound. The quietest of the
// first blocks sets the noise floor, and voice is anything 4 times louder (and above 0.01).
export function stopper({ quietMs = 700, waitMs = 4000, maxMs = 6000 } = {}) {
  let floor = Infinity;
  let voiceAt = null;
  let quietSince = null;
  return (level, ms) => {
    if (ms < 300) floor = Math.min(floor, level);
    const loud = level > Math.max(0.01, 4 * (Number.isFinite(floor) ? floor : 0.0025));
    if (loud) {
      voiceAt = voiceAt ?? ms;
      quietSince = null;
    } else if (voiceAt !== null) {
      quietSince = quietSince ?? ms;
    }
    if (ms >= maxMs) return 'done';
    if (voiceAt === null && ms >= waitMs) return 'silent';
    if (voiceAt !== null && quietSince !== null && ms - quietSince >= quietMs) return 'done';
    return null;
  };
}

function joined(chunks) {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

// Records one try from an open stream. Resolves { samples, rate, voice }, where voice is false
// when nothing louder than the room was heard. onLevel(level) is called 20 to 50 times a second
// for the meter. stop() on the returned object ends the try early. A clock also ends the try
// half a second after the longest try, in case no sound ever arrives (for example when the
// phone holds the audio for a call), so the microphone is never left on.
export function recordTry(stream, { onLevel = () => {} } = {}) {
  let stopNow = () => {};
  const done = (async () => {
    const ctx = new AudioContext();
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const decide = stopper();
    // The try's clock starts with the first block of sound, so the noise floor of the first
    // 300 ms is measured on real sound even when the worklet is slow to load.
    let started = null;
    const chunks = [];
    let outcome = null;
    let finish;
    const ended = new Promise((resolve) => { finish = resolve; });
    const check = (level) => {
      onLevel(level);
      if (started === null) started = performance.now();
      outcome = outcome ?? decide(level, performance.now() - started);
      if (outcome) finish();
    };
    stopNow = () => { outcome = outcome ?? 'done'; finish(); };
    const guard = setTimeout(() => { outcome = outcome ?? (started === null ? 'silent' : 'done'); finish(); }, 6500);
    let node = null;
    let recorder = null;
    let analyser = null;
    let timer = null;
    try {
      await ctx.audioWorklet.addModule(WORKLET_URL);
      node = new AudioWorkletNode(ctx, 'pcm-tap');
      let block = [];
      node.port.onmessage = (e) => {
        chunks.push(e.data);
        block.push(e.data);
        if (block.length >= 8) { check(rms(joined(block))); block = []; }
      };
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(node).connect(mute).connect(ctx.destination);
    } catch {
      // Without an audio worklet, MediaRecorder records and an analyser watches the level.
      recorder = new MediaRecorder(stream);
      const parts = [];
      recorder.ondataavailable = (e) => parts.push(e.data);
      recorder.start();
      analyser = ctx.createAnalyser();
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      timer = setInterval(() => { analyser.getFloatTimeDomainData(buf); check(rms(buf)); }, 50);
      recorder.parts = parts;
    }
    await ended;
    clearTimeout(guard);
    let samples = new Float32Array(0);
    const rate = ctx.sampleRate;
    try {
      if (recorder) {
        clearInterval(timer);
        if (recorder.state !== 'inactive') {
          const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
          recorder.stop();
          await stopped;
        }
        const audio = await ctx.decodeAudioData(await new Blob(recorder.parts).arrayBuffer());
        samples = audio.getChannelData(0).slice(0);
      } else {
        node.port.onmessage = null;
        source.disconnect();
        samples = joined(chunks);
      }
    } catch {
      // A recording that cannot be decoded (stopped at once, or empty) counts as no voice.
      outcome = 'silent';
    } finally {
      await ctx.close().catch(() => {});
    }
    return { samples, rate, voice: outcome !== 'silent' };
  })();
  return { done, stop: () => stopNow() };
}

// Plays a recording back ("Play my voice"). Resolves when it has played.
export async function playSamples({ samples, rate }) {
  const ctx = new AudioContext();
  const buffer = ctx.createBuffer(1, samples.length, rate);
  buffer.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  await new Promise((resolve) => { src.onended = resolve; src.start(); });
  await ctx.close();
}
