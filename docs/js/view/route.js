// Screens are chosen by the part of the address after '#', so the app is one page that
// works offline. For example '#/theme/t05' opens the word list of theme t05.
export const NAV = Object.freeze([
  { name: 'today', label: 'Today' },
  { name: 'map', label: 'Map' },
  { name: 'stats', label: 'Stats' },
  { name: 'badges', label: 'Badges' },
  { name: 'settings', label: 'Settings' },
]);

const SIMPLE = new Set(['today', 'session', 'checkin', 'map', 'stats', 'badges', 'settings']);

// parseRoute('#/word/w0026') gives { name: 'word', id: 'w0026' }. Anything unknown is Today.
export function parseRoute(hash) {
  const [name, id] = String(hash ?? '').replace(/^#\/?/, '').split('/');
  if ((name === 'theme' || name === 'word') && id) return { name, id: decodeURIComponent(id) };
  if (SIMPLE.has(name)) return { name };
  return { name: 'today' };
}

export function hrefOf(route) {
  return route.id ? `#/${route.name}/${encodeURIComponent(route.id)}` : `#/${route.name}`;
}
