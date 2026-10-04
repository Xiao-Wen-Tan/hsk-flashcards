// The release number and the words file of this version of the app. sw.js repeats both
// values, and tests/js/release.test.mjs checks that they agree. Every release that changes
// any file in docs/ raises RELEASE (r001, r002, ...), which makes phones show
// "Update available, tap to reload". When Plan 3 writes a newer words file, WORDS_FILE
// names it, and the release test fails until it does.
export const RELEASE = 'r009';
export const WORDS_FILE = 'data/words_v002.json';
