// The Today, Check-in, Progress map, theme word list, word card, Stats and Badges screens.
// Each one reads saved data, asks a view module in ../view/ what to show, and draws it.
import { canContinue, previewDay } from '../study.js';
import { studyDay } from '../dates.js';
import { todayView } from '../view/today.js';
import { badgesView, checkinView, mapView, statsView, themeWordsView, wordBackHref } from '../view/progress.js';
import { shortDate } from '../view/format.js';
import { badgeFacts } from '../badges.js';
import { currentStreak } from '../checkin.js';
import { dayStats, personalBests, todayCounters } from '../counters.js';
import { goals, nearest } from '../goals.js';
import { burst } from './confetti.js';
import { cardElement } from './card.js';
import { startSession } from './session.js';
import { h, show } from './dom.js';

async function checkedDays(app) {
  return (await app.store.allDays()).map((d) => d.day);
}

// Reads what the counters, goals and badges need, which is the saved words, check-in records,
// events and rewound days (meta 'rewound'), and badgeFacts() over them.
async function saved(app) {
  const [progress, days, events, rewound] = await Promise.all([
    app.store.allProgress(), app.store.allDays(), app.store.allEvents(), app.store.getMeta('rewound'),
  ]);
  const r = rewound ?? [];
  return { progress, days, events, rewound: r, facts: badgeFacts({ data: app.data, progress, days, events, rewound: r }) };
}

async function progressById(app) {
  return new Map((await app.store.allProgress()).map((p) => [p.id, p]));
}

// The day's ring, a circle that fills as the day's planned work gets done. It starts empty and
// fills smoothly (the CSS transition of .ring-fill), unless the phone asks for reduced motion.
function ringElement(share, label) {
  const NS = 'http://www.w3.org/2000/svg';
  const C = 2 * Math.PI * 52; // the length of the circle
  const circle = (cls) => {
    const c = document.createElementNS(NS, 'circle');
    for (const [k, v] of Object.entries({ cx: 60, cy: 60, r: 52, class: cls })) c.setAttribute(k, v);
    return c;
  };
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'ring');
  svg.setAttribute('aria-hidden', 'true');
  const fill = circle('ring-fill');
  fill.style.strokeDasharray = `${C}`;
  fill.style.strokeDashoffset = `${C}`;
  svg.append(circle('ring-track'), fill);
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.strokeDashoffset = `${C * (1 - share)}`; }));
  return h('div', { class: 'ring-box', role: 'img', 'aria-label': `${label} of today's work done` },
    svg, h('span', { class: 'ring-label' }, label));
}

// The four numbers of a day as tiles (tilesOf in view/today.js).
function tilesElement(tiles) {
  return h('div', { class: 'tiles4' }, tiles.map((t) => h('div', { class: 'tile4' }, h('b', {}, t.value), h('span', {}, t.label))));
}

export async function renderToday(app) {
  const today = studyDay();
  const plan = await previewDay({ store: app.store, data: app.data });
  const settings = { ...(await app.settings()) };
  const resumable = await canContinue({ store: app.store, data: app.data });
  const s = await saved(app);
  const checked = s.days.map((d) => d.day);
  const byId = new Map(s.progress.map((p) => [p.id, p]));
  const streak = currentStreak(checked, today, s.rewound);
  const v = todayView({
    plan, checkedDays: checked, today, settings, resumable, rewound: s.rewound,
    counters: todayCounters({ events: s.events, plan, day: today }),
    goals: nearest(goals({ data: app.data, progressById: byId, facts: s.facts, streak }), 2),
  });
  show(app.main,
    h('a', { class: 'streak', href: '#/checkin' }, h('span', { class: 'streak-n' }, v.streak), ' day streak'),
    h('div', { class: 'week' }, v.week.map((d) => h('span', {
      class: `day${d.checkedIn ? ' done' : ''}${d.isToday ? ' today' : ''}${d.future ? ' future' : ''}`,
    }, d.letter))),
    h('div', { class: 'today-top' },
      ringElement(v.ring, v.ringPct),
      h('div', { class: 'counts' },
        h('div', {}, h('b', {}, v.reviews), h('span', {}, 'reviews')),
        h('div', {}, h('b', {}, v.newWords), h('span', {}, 'new words')))),
    v.note ? h('p', { class: 'note' }, v.note) : null,
    h('p', { class: 'status' }, v.status),
    v.canStart ? h('button', {
      class: 'big start',
      onclick: async (e) => { e.target.disabled = true; await startSession(app); },
    }, v.startLabel) : null,
    h('h2', {}, 'Done today'),
    tilesElement(v.tiles),
    v.goals.length ? h('div', { class: 'goals' }, h('h2', {}, 'Next goals'), v.goals.map((g) => h('p', { class: 'goal' }, g))) : null);
}

export async function renderCheckin(app) {
  const today = app.lastResult?.day ?? studyDay();
  const events = await app.store.allEvents();
  const v = checkinView({
    result: app.lastResult, checkedDays: await checkedDays(app), today, themes: app.data.themes,
    counters: dayStats(events, today), bests: personalBests({ events, today }),
  });
  app.lastResult = null;
  show(app.main,
    h('h1', {}, v.title),
    v.streak !== null ? h('p', { class: 'streak' }, h('span', { class: 'streak-n' }, v.streak), ' day streak') : null,
    v.lines.map((line) => h('p', {}, line)),
    tilesElement(v.numbers),
    v.bests.map((b) => h('p', { class: 'best' }, b)),
    v.badges.length ? h('div', { class: 'new-badges' }, h('h2', {}, 'New badges'), v.badges.map((t) => h('p', { class: 'badge' }, t))) : null,
    h('h2', {}, v.monthTitle),
    h('table', { class: 'calendar' },
      h('tr', {}, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('th', {}, d))),
      v.weeks.map((week) => h('tr', {}, week.map((c) => h('td', {
        class: c ? `${c.checkedIn ? 'done' : ''}${c.isToday ? ' today' : ''}` : '',
      }, c ? c.date : ''))))),
    h('a', { class: 'button big', href: '#/today' }, 'Back to Today'));
  if (v.confetti) burst(app.main);
}

export async function renderMap(app) {
  const sections = mapView(app.data, await progressById(app));
  show(app.main, h('h1', {}, 'Progress map'),
    sections.map((s) => h('section', { class: `group-section${s.done ? ' done' : ''}` },
      h('h2', {}, s.title, s.statusLabel ? h('span', { class: 'group-status' }, ` ${s.statusLabel}`) : null),
      h('p', { class: 'group-counts' }, s.counts),
      h('div', { class: 'tiles' }, s.tiles.map((t) => h('a', { class: `tile ${t.status}`, href: t.href, style: `--theme:${t.color}` },
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
      h('a', { href: w.href },
        h('span', { class: 'w-hz', lang: 'zh-CN' }, w.hz), h('span', { class: 'w-py' }, w.py),
        h('span', { class: 'w-en' }, w.enShort), h('span', { class: 'w-status' }, w.status))))));
}

export async function renderWord(app, wordId, groupId) {
  const word = app.wordsById.get(wordId);
  if (!word) { window.location.hash = '#/map'; return; }
  const settings = await app.settings();
  show(app.main, h('a', { href: wordBackHref(word, groupId) }, 'Back to the theme'),
    cardElement(app, word, { autoplay: settings.autoplay !== false }));
}

// A bar chart of new words and reviews per day. A checked-in day's bar has the main colour.
function chartElement(rows, withLabels) {
  return [
    h('div', { class: 'chart' }, rows.map((r) => h('span', {
      class: `col${r.checkedIn ? ' done' : ''}`,
      title: `${shortDate(r.day)}: ${r.newWords} new words, ${r.reviews} reviews`,
      style: `height:${Math.round(r.height * 100)}%`,
    }))),
    withLabels ? h('div', { class: 'chart-labels' }, rows.map((r) => h('span', {}, r.label))) : null,
  ];
}

// Stats in the four sections of the spec of 2026-10-03 (statsView in view/progress.js).
export async function renderStats(app) {
  const today = studyDay();
  const s = await saved(app);
  const checked = s.days.map((d) => d.day);
  const streak = currentStreak(checked, today, s.rewound);
  const byId = new Map(s.progress.map((p) => [p.id, p]));
  const v = statsView({
    data: app.data, progressList: s.progress, events: s.events, checkedDays: checked, today, rewound: s.rewound,
    goals: goals({ data: app.data, progressById: byId, facts: s.facts, streak }),
  });
  show(app.main, h('h1', {}, 'Stats'),
    h('h2', {}, 'This week and this month'),
    v.periods.map((p) => [h('h3', {}, p.title), tilesElement(p.numbers)]),
    h('h3', {}, 'New words and reviews, last 7 days'),
    chartElement(v.bars7, true),
    h('h3', {}, 'Last 30 days'),
    chartElement(v.bars30, false),
    h('h3', {}, 'Reviews due in the next 7 days'),
    h('table', { class: 'forecast' },
      h('tr', {}, v.forecast.map((r) => h('th', {}, r.label))),
      h('tr', {}, v.forecast.map((r) => h('td', {}, r.due)))),
    h('h3', {}, 'Accuracy, last 7 days'),
    h('p', {}, v.accuracy),
    h('h2', {}, 'All-time records'),
    h('dl', { class: 'records' }, v.records.map((r) => h('div', {}, h('dt', {}, r.label), h('dd', {}, r.value)))),
    h('h2', {}, 'HSK levels'),
    v.levels.map((l) => h('div', { class: 'level' }, h('span', {}, l.label),
      h('span', { class: 'bar' }, h('span', { class: 'bar-learned', style: `width:${l.learnedPct}` }),
        h('span', { class: 'bar-mastered', style: `width:${l.masteredPct}` })),
      h('span', { class: 'muted' }, l.text))),
    h('h2', {}, 'Goals'),
    v.goals.length ? v.goals.map((g) => h('p', { class: 'goal' }, g)) : h('p', { class: 'muted' }, 'Every goal is reached.'));
}

// The Badges screen shows each group's earned badges with their days, then the next one greyed
// out with its progress.
export async function renderBadges(app) {
  const { facts } = await saved(app);
  const v = badgesView({ earned: await app.store.getMeta('badges'), facts, themes: app.data.themes });
  show(app.main, h('h1', {}, 'Badges'),
    v.count ? null : h('p', { class: 'muted' }, 'No badges yet. Your first check-ins will earn some.'),
    v.groups.map((g) => h('section', { class: 'badge-group' },
      h('h2', {}, g.title),
      g.earned.map((b) => h('p', { class: 'badge' }, b.title, h('span', { class: 'muted' }, ` ${shortDate(b.day)}`))),
      g.next ? h('div', { class: 'badge locked' },
        h('span', { class: 'badge-title' }, g.next.title),
        g.next.pct === null ? null : h('span', { class: 'bar' }, h('span', { class: 'bar-learned', style: `width:${g.next.pct}` })),
        h('span', { class: 'muted' }, g.next.text)) : null)));
}
