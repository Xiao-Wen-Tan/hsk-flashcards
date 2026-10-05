// Sound playback. A word plays twice with a short pause, and a new sound or a tap on Next
// stops the one before. The audio element and the pause are passed in, so Node can test
// this with a stand-in element.
//
//   const player = createPlayer();
//   await player.play('audio/w/w0026_6ce06b7e.mp3', 2);   // 'done', or 'stopped' after stop()
//
// play() rejects when the phone refuses to play. Chrome says 'NotAllowedError' when sound
// needs a tap first (for example after the app was in the background), and the session
// screen then shows "Tap to continue".
export function createPlayer({
  makeAudio = () => new Audio(),
  wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); }),
  gapMs = 700,
} = {}) {
  const el = makeAudio();
  let token = 0;
  let pending = null; // resolves the sound that is playing now, when stop() cuts it short

  function once(url) {
    return new Promise((resolve, reject) => {
      pending = resolve;
      el.onended = () => { pending = null; resolve('ended'); };
      el.onerror = () => { pending = null; reject(new Error(`Could not play ${url}`)); };
      el.src = url;
      const started = el.play();
      if (started && started.catch) started.catch((err) => { pending = null; reject(err); });
    });
  }

  async function play(url, times = 2) {
    stop();
    const mine = token;
    for (let i = 0; i < times; i += 1) {
      const how = await once(url);
      if (mine !== token || how === 'stopped') return 'stopped';
      if (i < times - 1) {
        await wait(gapMs);
        if (mine !== token) return 'stopped';
      }
    }
    return 'done';
  }

  function stop() {
    token += 1;
    el.onended = null;
    el.onerror = null;
    if (typeof el.pause === 'function') el.pause();
    if (pending) {
      const cut = pending;
      pending = null;
      cut('stopped');
    }
  }

  return { play, stop };
}
