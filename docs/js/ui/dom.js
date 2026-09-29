// A tiny way to build page elements. h('button', { class: 'big', onclick: go }, 'Start')
// makes <button class="big">Start</button> that calls go() when tapped.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style') el.style.cssText = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key in el && typeof value !== 'string') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

// Replaces what `main` shows and scrolls to the top.
export function show(main, ...children) {
  main.replaceChildren(...children.flat(Infinity).filter(Boolean));
  window.scrollTo(0, 0);
}
