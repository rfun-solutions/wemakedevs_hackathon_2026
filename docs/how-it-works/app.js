/* global document, fetch */
// Renders features.json (built from the registry by scripts/build-how-it-works.mjs). textContent only.
const SPONSORS = [
  ['gitar', 'Gitar'],
  ['dash0', 'Dash0'],
  ['radar', 'Radar'],
];

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function techItem(t) {
  const code = el('code', { lang: 'en' }, t.label);
  const li = el('li', { class: 'tech' }, t.href ? el('a', { href: t.href }, code) : code);
  if (t.signin) li.append(el('span', { class: 'note' }, 'Dash0 sign-in needed'));
  if (t.live) li.append(el('span', { class: 'note' }, 'Live value in the app'));
  return li;
}

function entrySection(entry, promisesById) {
  const id = `f-${entry.id}`;
  const section = el('section', { class: 'entry', 'aria-labelledby': id });
  section.append(el('h3', { id }, entry.title), el('p', {}, entry.what));
  const served = entry.promises.map((p) => promisesById.get(p)).filter(Boolean);
  if (served.length) {
    const ul = el('ul', { class: 'chips', 'aria-label': 'Promises it serves' });
    for (const p of served) ul.append(el('li', { class: 'chip' }, el('strong', {}, p.id), ` ${p.text}`));
    section.append(ul);
  }
  for (const [key, name] of SPONSORS) {
    const items = entry.tech.filter((t) => t.sponsor === key);
    if (!items.length) continue;
    const ul = el('ul');
    for (const t of items) ul.append(techItem(t));
    section.append(el('div', { class: 'group' }, el('h4', {}, name), ul));
  }
  return section;
}

async function main() {
  const status = document.getElementById('status');
  try {
    const res = await fetch('features.json');
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const promisesById = new Map(data.promises.map((p) => [p.id, p]));
    const promises = document.getElementById('promises');
    for (const p of data.promises) {
      promises.append(el('li', {}, el('strong', {}, p.id), ` ${p.text}`));
    }
    const features = document.getElementById('features');
    for (const e of data.entries) features.append(entrySection(e, promisesById));
    status.textContent = `${data.entries.length} features listed.`;
  } catch {
    status.textContent = 'The feature list could not be loaded. Please reload the page.';
  }
}
main();
