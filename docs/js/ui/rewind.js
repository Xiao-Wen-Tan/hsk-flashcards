// The "Go back to a day" screen ('#/rewind'), opened from Settings. The learner taps a day in the
// calendar, reads what will be undone, and confirms. The backup file can be saved first. After
// going back, the 'rewound' hook lets the Google Sheet backup replace the Sheet's copy.
import { studyDay } from '../dates.js';
import { confirmText, rewindChoices, rewindPlan, rewindTo } from '../rewind.js';
import { rewindCalendar, startMonth } from '../view/rewind.js';
import { shortDate } from '../view/format.js';
import { saveBackupFile } from './settings.js';
import { h, show } from './dom.js';

export async function renderRewind(app) {
  const today = studyDay();
  const [events, days, badges, rewound] = await Promise.all([
    app.store.allEvents(), app.store.allDays(), app.store.getMeta('badges'), app.store.getMeta('rewound'),
  ]);
  const choices = rewindChoices({ events, days, today });
  const back = h('a', { class: 'button big', href: '#/settings' }, 'Back to Settings');
  if (!choices.length) {
    show(app.main, h('h1', {}, 'Go back to a day'), h('p', {}, 'There is no earlier study day to go back to yet.'), back);
    return;
  }
  let month = startMonth(choices, today);
  const area = h('div', {});

  // The confirmation for one day, with what going back undoes.
  function ask(day) {
    const plan = rewindPlan({ events, days, badges: badges ?? {}, rewound: rewound ?? [], toDay: day, today });
    area.replaceChildren(
      h('h2', {}, `Go back to ${shortDate(day)}?`),
      h('p', { class: 'confirm-text' }, confirmText(plan)),
      h('button', { class: 'small', onclick: () => saveBackupFile(app) }, 'Save a backup file first'),
      h('button', {
        class: 'big danger',
        onclick: async (e) => {
          e.target.disabled = true;
          await rewindTo({ store: app.store, toDay: day });
          await app.hooks.emit('rewound', { store: app.store });
          app.note(`Gone back to ${shortDate(day)}.`);
          window.location.hash = '#/today';
        },
      }, `Go back to ${shortDate(day)}`),
      h('button', { class: 'small', onclick: draw }, 'Cancel'));
  }

  // The calendar of one month, where only the days that can be chosen are buttons.
  function draw() {
    const v = rewindCalendar({ choices, month, today });
    area.replaceChildren(
      h('div', { class: 'month-nav' },
        h('button', { class: 'small', disabled: !v.prev, onclick: () => { month = v.prev; draw(); } }, 'Earlier'),
        h('h2', {}, v.title),
        h('button', { class: 'small', disabled: !v.next, onclick: () => { month = v.next; draw(); } }, 'Later')),
      h('table', { class: 'calendar rewind' },
        h('tr', {}, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('th', {}, d))),
        v.weeks.map((week) => h('tr', {}, week.map((c) => h('td', { class: c?.isToday ? 'today' : '' },
          c?.choosable ? h('button', { class: 'day-pick', onclick: () => ask(c.day) }, c.date) : (c ? c.date : '')))))));
  }

  show(app.main, h('h1', {}, 'Go back to a day'),
    h('p', {}, 'Tap a day. Everything after it is undone: answers, check-ins and badges. The settings stay.'),
    area, back);
  draw();
}
