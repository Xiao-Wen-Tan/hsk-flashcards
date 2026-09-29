// The Today, Check-in, Progress map, theme word list, word card, Stats and Badges screens.
// Each one reads saved data, asks a view module in ../view/ what to show, and draws it.
import { previewDay } from '../study.js';
import { studyDay, addDays } from '../dates.js';
import { todayView } from '../view/today.js';
import { badgesView, checkinView, mapView, statsView, themeWordsView } from '../view/progress.js';
import { shortDate } from '../view/format.js';
import { cardElement } from './card.js';
import { startSession } from './session.js';
import { h, show } from './dom.js';

async function checkedDays(app) {
  return (await app.store.allDays()).map((d) => d.day);
}

async function progressById(app) {
  return new Map((await app.store.allProgress()).map((p) => [p.id, p]));
}

export async function renderToday(app) {
  const today = studyDay();
  const plan = await previewDay({ store: app.store, data: app.data });
  const settings = { ...(await app.settings()) };
  const v = todayView({ plan, checkedDays: await checkedDays(app), today, settings });
  show(app.main,
    h('a', { class: 'streak', href: '#/checkin' }, h('span', { class: 'streak-n' }, v.streak), ' day streak'),
    h('div', { class: 'week' }, v.week.map((d) => h('span', {
      class: `day${d.checkedIn ? ' done' : ''}${d.isToday ? ' today' : ''}${d.future ? ' future' : ''}`,
    }, d.letter))),
    h('div', { class: 'counts' },
      h('div', {}, h('b', {}, v.reviews), h('span', {}, 'reviews')),
      h('div', {}, h('b', {}, v.newWords), h('span', {}, 'new words'))),
    v.note ? h('p', { class: 'note' }, v.note) : null,
    h('p', { class: 'status' }, v.status),
    v.canStart ? h('button', {
      class: 'big start',
      onclick: async (e) => { e.target.disabled = true; await startSession(app); },
    }, v.startLabel) : null);
}

export async function renderCheckin(app) {
  const today = app.lastResult?.day ?? studyDay();
  const v = checkinView({ result: app.lastResult, checkedDays: await checkedDays(app), today, themes: app.data.themes });
  app.lastResult = null;
  show(app.main,
    h('h1', {}, v.title),
    v.streak !== null ? h('p', { class: 'streak' }, h('span', { class: 'streak-n' }, v.streak), ' day streak') : null,
    v.lines.map((line) => h('p', {}, line)),
    v.badges.length ? h('div', { class: 'new-badges' }, h('h2', {}, 'New badges'), v.badges.map((t) => h('p', { class: 'badge' }, t))) : null,
    h('h2', {}, v.monthTitle),
    h('table', { class: 'calendar' },
      h('tr', {}, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('th', {}, d))),
      v.weeks.map((week) => h('tr', {}, week.map((c) => h('td', {
        class: c ? `${c.checkedIn ? 'done' : ''}${c.isToday ? ' today' : ''}` : '',
      }, c ? c.date : ''))))),
    h('a', { class: 'button big', href: '#/today' }, 'Back to Today'));
}

export async function renderMap(app) {
  const sections = mapView(app.data, await progressById(app));
  show(app.main, h('h1', {}, 'Progress map'),
    sections.map((s) => h('section', { class: `level${s.done ? ' done' : ''}` },
      h('h2', {}, s.title, s.statusLabel ? h('span', { class: 'level-status' }, ` ${s.statusLabel}`) : null),
      h('p', { class: 'level-counts' }, s.counts),
      h('div', { class: 'tiles' }, s.tiles.map((t) => h('a', { class: `tile ${t.status}`, href: t.href },
        h('span', { class: 'tile-status' }, t.statusLabel),
        h('span', { class: 'tile-name' }, t.name),
        h('span', { class: 'bar' },
          h('span', { class: 'bar-learned', style: `width:${t.learnedPct}` }),
          h('span', { class: 'bar-mastered', style: `width:${t.masteredPct}` })),
        h('span', { class: 'tile-counts' }, t.counts)))))));
}

export async function renderTheme(app, themeId, groupId) {
  const v = themeWordsView(app.data, themeId, await progressById(app), groupId);
  if (!v) { window.location.hash = '#/map'; return; }
  show(app.main, h('a', { href: '#/map' }, 'Back to the map'), h('h1', {}, v.name),
    h('ul', { class: 'words' }, v.words.map((w) => h('li', {},
      h('a', { href: `#/word/${w.id}` },
        h('span', { class: 'w-hz', lang: 'zh-CN' }, w.hz), h('span', { class: 'w-py' }, w.py),
        h('span', { class: 'w-en' }, w.enShort), h('span', { class: 'w-status' }, w.status))))));
}

export async function renderWord(app, wordId) {
  const word = app.wordsById.get(wordId);
  if (!word) { window.location.hash = '#/map'; return; }
  const settings = await app.settings();
  show(app.main, h('a', { href: `#/theme/${word.theme}` }, 'Back to the theme'),
    cardElement(app, word, { autoplay: settings.autoplay !== false }));
}

export async function renderStats(app) {
  const today = studyDay();
  const v = statsView({
    data: app.data,
    progressList: await app.store.allProgress(),
    events: await app.store.eventsFrom(addDays(today, -29)),
    checkedDays: await checkedDays(app),
    today,
  });
  show(app.main, h('h1', {}, 'Stats'),
    h('div', { class: 'counts' },
      h('div', {}, h('b', {}, v.learned), h('span', {}, 'learned')),
      h('div', {}, h('b', {}, v.mastered), h('span', {}, 'mastered')),
      h('div', {}, h('b', {}, v.total), h('span', {}, 'words in all'))),
    h('h2', {}, 'HSK levels'),
    v.levels.map((l) => h('div', { class: 'level' }, h('span', {}, l.label),
      h('span', { class: 'bar' }, h('span', { class: 'bar-learned', style: `width:${l.learnedPct}` }),
        h('span', { class: 'bar-mastered', style: `width:${l.masteredPct}` })),
      h('span', { class: 'muted' }, l.text))),
    h('h2', {}, 'Last 30 days'),
    h('div', { class: 'chart' }, v.activity.map((r) => h('span', {
      class: `col${r.checkedIn ? ' done' : ''}`,
      title: `${shortDate(r.day)}: ${r.reviews} reviews, ${r.learned} learned`,
      style: `height:${Math.round(r.height * 100)}%`,
    }))),
    h('h2', {}, 'Reviews due in the next 7 days'),
    h('table', { class: 'forecast' },
      h('tr', {}, v.forecast.map((r) => h('th', {}, r.label))),
      h('tr', {}, v.forecast.map((r) => h('td', {}, r.due)))),
    h('h2', {}, 'Accuracy, last 7 days'),
    h('p', {}, v.accuracy));
}

export async function renderBadges(app) {
  const v = badgesView({
    earned: await app.store.getMeta('badges'),
    data: app.data,
    progressList: await app.store.allProgress(),
    checkedDays: await checkedDays(app),
  });
  show(app.main, h('h1', {}, 'Badges'),
    v.earned.length ? v.earned.map((b) => h('p', { class: 'badge' }, b.title, h('span', { class: 'muted' }, ` ${shortDate(b.day)}`)))
      : h('p', { class: 'muted' }, 'No badges yet. Your first check-ins will earn some.'),
    h('h2', {}, 'Next milestones'),
    v.upcoming.map((u) => h('p', { class: 'badge locked' }, u.title, h('span', { class: 'muted' }, ` (${u.have})`))));
}
