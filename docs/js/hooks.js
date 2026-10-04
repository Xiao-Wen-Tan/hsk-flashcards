// A small hook system, so a later module can join the app without changing the screens.
// Plan 5's Google Sheet backup is such a module. It is listed in plugins.js and gets
// install({ on, store, data }) at start-up. The app then calls these hooks:
//   'open'        ({ store, data })          when the app starts and when it comes back to the screen
//   'hidden'      ({ store })                when the app goes to the background or is closed
//   'sessionEnd'  ({ store, result })        after a study session or the speaking panel ends (result is
//                                            Study.finish()'s or speaking.js close()'s result)
//   'settings'    ({ container, store })     when Settings is drawn, to add a section to container
//   'rewound'     ({ store })                after "Go back to a day" (ui/rewind.js) or "Reset everything"
//                                            (ui/settings.js) changed the saved history
// A failing handler is logged and skipped, so a backup problem never stops a study session.
export const HOOK_NAMES = Object.freeze(['open', 'hidden', 'sessionEnd', 'settings', 'rewound']);

export function createHooks({ log = (...args) => console.warn(...args) } = {}) {
  const handlers = new Map(HOOK_NAMES.map((name) => [name, []]));
  function on(name, fn) {
    if (!handlers.has(name)) throw new Error(`Unknown hook ${name}`);
    handlers.get(name).push(fn);
  }
  async function emit(name, arg) {
    for (const fn of handlers.get(name) ?? []) {
      try {
        await fn(arg);
      } catch (err) {
        log(`Hook ${name} failed:`, err);
      }
    }
  }
  return { on, emit };
}

// Imports each module of `paths` and calls its install(context). A module that fails to
// load or install is logged and skipped.
export async function loadPlugins(paths, context, {
  importer = (path) => import(path), log = (...args) => console.warn(...args),
} = {}) {
  for (const path of paths) {
    try {
      const mod = await importer(path);
      await mod.install(context);
    } catch (err) {
      log(`Plugin ${path} failed:`, err);
    }
  }
}
