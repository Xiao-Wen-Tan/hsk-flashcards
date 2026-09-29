// Screens are chosen by the part of the address after '#', so the app is one page that
// works offline. For example '#/theme/t05' opens the word list of theme t05, and
// '#/theme/t05/3' only its HSK 3 words (a map tile, see stats.js LEVEL_GROUPS).
export const NAV = Object.freeze([
  { name: 'today', label: 'Today' },
  { name: 'map', label: 'Map' },
  { name: 'stats', label: 'Stats' },
  { name: 'badges', label: 'Badges' },
  { name: 'settings', label: 'Settings' },
]);

const SIMPLE = new Set(['today', 'session', 'checkin', 'map', 'stats', 'badges', 'settings']);

// parseRoute('#/word/w0026') gives { name: 'word', id: 'w0026' }, and parseRoute('#/theme/t05/3')
// gives { name: 'theme', id: 't05', group: '3' }. Anything unknown is Today.
export function parseRoute(hash) {
  const [name, id, group] = String(hash ?? '').replace(/^#\/?/, '').split('/');
  if (name === 'theme' && id && group) return { name, id: decodeURIComponent(id), group: decodeURIComponent(group) };
  if ((name === 'theme' || name === 'word') && id) return { name, id: decodeURIComponent(id) };
  if (SIMPLE.has(name)) return { name };
  return { name: 'today' };
}

export function hrefOf(route) {
  if (!route.id) return `#/${route.name}`;
  const base = `#/${route.name}/${encodeURIComponent(route.id)}`;
  return route.group ? `${base}/${encodeURIComponent(route.group)}` : base;
}
