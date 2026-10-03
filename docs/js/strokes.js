// Stroke-order animation with Hanzi Writer (MIT licence), a stroke-animation library kept
// in docs/vendor/, and its character data (Arphic Public License) kept in docs/strokes/.
// Each character's data file is named by its Unicode code point in hexadecimal, so 爱
// (U+7231) is strokes/72/7231.json, in a folder named by the first two digits. The functions above animateWord never touch the page.

export const HANZI_WRITER = '../vendor/hanzi-writer-3.7.3.esm.js'; // relative to this file
export const STROKES_BASE = 'strokes/'; // relative to index.html

// The characters that get a stroke animation. A pattern word's '…' is left out.
// charsOf('虽然…但是…') gives ['虽', '然', '但', '是'].
export function charsOf(hz) {
  return [...hz].filter((ch) => /\p{Script=Han}/u.test(ch));
}

// strokeUrl('爱') gives 'strokes/72/7231.json'. The folder is the first two hex digits, so no folder
// holds more than a few dozen files (tools/strokedata.py stroke_name makes the same name).
export function strokeUrl(ch, base = STROKES_BASE) {
  const code = ch.codePointAt(0).toString(16);
  return `${base}${code.slice(0, 2)}/${code}.json`;
}

// Loads the stroke data of every character, or fails with a plain message when one file
// cannot be fetched (for example offline, before the file was saved on the phone).
export async function loadStrokeData(chars, fetchFn = globalThis.fetch) {
  const data = new Map();
  for (const ch of chars) {
    let res;
    try {
      res = await fetchFn(strokeUrl(ch));
    } catch {
      res = null;
    }
    if (!res || !res.ok) throw new Error(`Stroke order for ${ch} is not on this phone yet. Connect to the internet once to get it.`);
    data.set(ch, await res.json());
  }
  return data;
}

// Draws each character of hz in `container` and animates them one after another.
// Browser only. For example animateWord(box, '苹果') animates 苹, then 果.
export async function animateWord(container, hz, { size = 120, importer = () => import(HANZI_WRITER) } = {}) {
  const chars = charsOf(hz);
  const [data, mod] = await Promise.all([loadStrokeData(chars), importer()]);
  const HanziWriter = mod.default;
  container.replaceChildren();
  const writers = chars.map((ch) => {
    const box = document.createElement('div');
    box.className = 'stroke-box';
    container.append(box);
    return HanziWriter.create(box, ch, {
      width: size, height: size, padding: 6, showOutline: true, showCharacter: false,
      strokeAnimationSpeed: 1, delayBetweenStrokes: 250, strokeColor: '#b3261e',
      charDataLoader: (c) => data.get(c),
    });
  });
  for (const writer of writers) {
    await new Promise((resolve) => { writer.animateCharacter({ onComplete: resolve }); });
  }
}
