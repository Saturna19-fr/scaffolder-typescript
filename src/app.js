'use strict';
/* ------------------------------------------------------------------ data */
const J = id => JSON.parse(document.getElementById(id).textContent);
const TS = J('D_TS'), OXC = J('D_OXC'), OXR = J('D_OXR');
const TSO = TS.options, TSW = TS.watch, TSROOT = TS.root, TSACQ = TS.typeAcquisition;
const TSOByName = Object.fromEntries(TSO.map(o => [o.name, o]));
const RuleByKey = Object.fromEntries(OXR.map(r => [r.p + '/' + r.n, r]));
const BUILTIN_OX = ['eslint', 'oxc', 'typescript', 'unicorn'];
const VER = { ts7: TS.tsVersions.v7, ts5: TS.tsVersions.v5, ox: '1.87.0' };

const CAT_ORDER = ['Type Checking', 'Modules', 'Emit', 'JavaScript Support', 'Interop Constraints',
  'Language and Environment', 'Compiler Diagnostics', 'Projects', 'Output Formatting',
  'Completeness', 'Editor Support', 'Watch and Build Modes', 'Backwards Compatibility', 'Other'];
const OX_CATS = ['correctness', 'suspicious', 'pedantic', 'perf', 'style', 'restriction', 'nursery'];
const OX_CAT_DOC = {
  correctness: 'Code franchement faux ou inutile. Activé par défaut (error).',
  suspicious: 'Code très probablement faux ou inutile.',
  pedantic: 'Règles strictes, avec des faux positifs occasionnels.',
  perf: 'Code qui pourrait être écrit de façon plus performante.',
  style: 'Code qui devrait être écrit de façon plus idiomatique.',
  restriction: 'Interdit l’usage de certaines fonctionnalités du langage ou de la lib.',
  nursery: 'Nouvelles règles encore en développement — instables.'
};
const FIX_DOC = {
  none: ['pas de fix', ''], pending: ['fix prévu', 'Un auto-fix est prévu mais pas encore implémenté.'],
  fixable_fix: ['fix', 'Un auto-fix sûr est disponible.'],
  fixable_suggestion: ['suggestion', 'Une suggestion est disponible (--fix-suggestions).'],
  fixable_dangerous_fix: ['fix risqué', 'Un auto-fix dangereux est disponible (--fix-dangerously).'],
  fixable_dangerous_suggestion: ['suggestion risquée', 'Une suggestion dangereuse est disponible (--fix-dangerously).'],
  fixable_safe_fix_or_suggestion: ['fix/suggestion', 'Un auto-fix et une suggestion sont disponibles.'],
  fixable_dangerous_fix_or_suggestion: ['fix/suggestion risqués', 'Un auto-fix et une suggestion dangereux sont disponibles.'],
  conditional_fix: ['fix partiel', 'Un auto-fix est disponible pour certaines violations.'],
  conditional_suggestion: ['suggestion partielle', 'Une suggestion est disponible pour certaines violations.'],
  conditional_safe_fix_or_suggestion: ['fix/suggestion partiels', 'Un auto-fix et une suggestion sont disponibles pour certaines violations.'],
  conditional_dangerous_fix: ['fix risqué partiel', 'Un auto-fix dangereux est disponible pour certaines violations.'],
  conditional_dangerous_fix_or_suggestion: ['fix/suggestion risqués partiels', 'Un auto-fix et une suggestion dangereux sont disponibles pour certaines violations.']
};

/* ------------------------------------------------------------------ state */
const SKEY = 'ts-oxlint-scaffolder/v1';
const fresh = () => ({
  tsVer: '7', tab: 'tsco', out: 'tsconfig', comments: false, q: '',
  ts: {}, tsRoot: {}, tsWatch: {}, tsAcq: {},
  ox: {
    plugins: BUILTIN_OX.slice(), categories: {}, env: {}, globals: {},
    ignorePatterns: [], options: {}, settings: {}, rules: {}, ruleOpts: {}, rulePos: {}, extends: [], overrides: ''
  },
  pkg: { pm: 'pnpm', tsLine: '7', scripts: true, oxTypeAware: false },
  f: { plugin: '', cat: '', fix: '', ta: '', def: '', sel: '', src: '', opt: '' },
  open: {}
});
let S = fresh();
try {
  const raw = localStorage.getItem(SKEY);
  if (raw) S = Object.assign(fresh(), JSON.parse(raw));
} catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) {} };

/* ------------------------------------------------------------------ utils */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = (tag, attrs, html) => {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
  }
  if (html != null) n.innerHTML = html;
  return n;
};
function md(src) {
  if (!src) return '';
  const blocks = [];
  let s = String(src).replace(/```(\w*)\n?([\s\S]*?)```/g, (m, l, c) => {
    blocks.push('<pre><code>' + esc(c.replace(/\s+$/, '')) + '</code></pre>');
    return '\u0000' + (blocks.length - 1) + '\u0000';
  });
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:)]|$)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)]|$)/g, '$1<em>$2</em>');
  const out = [];
  for (const para of s.split(/\n{2,}/)) {
    const hm = para.match(/^(#{3,6})\s+(.*)$/);
    if (hm) { out.push('<p class="mdh"><strong>' + hm[2] + '</strong></p>'); continue; }
    const lines = para.split('\n');
    if (lines.every(l => /^\s*(?:[-*•]\s|\d+\.\s)/.test(l) || /^\s{2,}\S/.test(l))) {
      out.push('<ul>' + lines.filter(l => l.trim()).map(l => '<li>' + l.replace(/^\s*(?:[-*•]\s|\d+\.\s)/, '') + '</li>').join('') + '</ul>');
    } else out.push('<p>' + lines.join('<br>') + '</p>');
  }
  return out.join('').replace(/\u0000(\d+)\u0000/g, (m, i) => blocks[+i]);
}
function flash(msg) {
  const f = $('#flash'); f.textContent = msg; f.classList.add('show');
  clearTimeout(flash._t); flash._t = setTimeout(() => f.classList.remove('show'), 1600);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); flash('Copié ✓'); return; } catch (e) {}
  const t = el('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
  document.body.appendChild(t); t.select();
  try { document.execCommand('copy'); flash('Copié ✓'); } catch (e) { flash('Copie impossible'); }
  t.remove();
}
function download(name, text) {
  const b = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = el('a', { href: URL.createObjectURL(b), download: name });
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
const matches = (q, ...fields) => { q = q.trim().toLowerCase(); return !q || fields.some(f => f && String(f).toLowerCase().includes(q)); };

/* ---------------------------------------------------- generic value widgets
   value === undefined  ->  option absent from the generated config          */
function widget(opt, value, onChange) {
  const t = opt.type, wrap = el('span', { class: 'octl' });
  const seg = (vals, cur) => {
    const s = el('div', { class: 'seg' });
    vals.forEach(([v, label]) => s.appendChild(el('button', {
      type: 'button', 'data-v': String(v), 'aria-pressed': String(cur === v || (v === '\u0000' && cur === undefined)),
      onclick: () => onChange(v === '\u0000' ? undefined : v)
    }, esc(label))));
    return s;
  };
  if (t === 'boolean') { wrap.appendChild(seg([['\u0000', 'défaut'], [true, 'true'], [false, 'false']], value)); return wrap; }
  if (t === 'enum' && opt.enum) {
    const sel = el('select', { onchange: e => onChange(e.target.value === '\u0000' ? undefined : e.target.value) });
    sel.appendChild(el('option', { value: '\u0000' }, '— défaut —'));
    opt.enum.forEach(v => {
      const legacy = (opt.enumLegacy || []).includes(v);
      sel.appendChild(el('option', { value: v, selected: value === v }, esc(v) + (legacy ? ' (legacy)' : '')));
    });
    wrap.appendChild(sel); return wrap;
  }
  if (t === 'number') {
    wrap.appendChild(el('input', {
      type: 'number', value: value == null ? '' : value, placeholder: 'défaut',
      oninput: e => onChange(e.target.value === '' ? undefined : Number(e.target.value))
    }));
    return wrap;
  }
  if (t === 'list' && opt.enum && opt.enum.length) {
    const box = el('div', { class: 'chips', style: 'margin-top:6px;max-width:100%' });
    const cur = Array.isArray(value) ? value.slice() : [];
    opt.enum.forEach(v => box.appendChild(el('button', {
      type: 'button', class: 'chip sm', 'aria-pressed': String(cur.includes(v)),
      onclick: () => { const i = cur.indexOf(v); i < 0 ? cur.push(v) : cur.splice(i, 1); onChange(cur.length ? cur : undefined); }
    }, esc(v))));
    const w = el('div', { style: 'width:100%' });
    w.appendChild(el('div', { class: 'octl' }, '')).appendChild(el('span', { class: 't' }, cur.length ? cur.length + ' sélectionné(s)' : 'défaut'));
    w.appendChild(box);
    return w;
  }
  if (t === 'list') {
    const w = el('div', { style: 'width:100%;margin-top:6px' });
    w.appendChild(el('input', {
      type: 'text', class: 'wide', placeholder: 'valeurs séparées par des virgules', value: Array.isArray(value) ? value.join(', ') : '',
      oninput: e => { const a = e.target.value.split(',').map(x => x.trim()).filter(Boolean); onChange(a.length ? a : undefined); }
    }));
    return w;
  }
  if (t === 'object' || t === 'raw') {
    const w = el('div', { style: 'width:100%;margin-top:6px' });
    const ta = el('textarea', {
      spellcheck: 'false', placeholder: t === 'object' ? '{ "@/*": ["./src/*"] }' : 'JSON',
      oninput: e => {
        const v = e.target.value.trim();
        if (!v) { ta.style.borderColor = ''; onChange(undefined); return; }
        try { const p = JSON.parse(v); ta.style.borderColor = ''; onChange(p); }
        catch (err) { ta.style.borderColor = 'var(--err)'; }
      }
    });
    ta.value = value === undefined ? '' : JSON.stringify(value, null, 2);
    w.appendChild(ta);
    return w;
  }
  wrap.appendChild(el('input', {
    type: 'text', value: value == null ? '' : value, placeholder: 'défaut',
    oninput: e => onChange(e.target.value === '' ? undefined : e.target.value)
  }));
  return wrap;
}

/* ------------------------------------------------------------ TS rendering */
function tsVisible(o) {
  if (S.tsVer === '7' && !o.avail.includes('7')) return false;
  if (S.tsVer === '5' && !o.avail.includes('5')) return false;
  return true;
}
function optRow(o, kind) {
  const store = kind === 'watch' ? S.tsWatch : kind === 'acq' ? S.tsAcq : kind === 'root' ? S.tsRoot : S.ts;
  const on = Object.prototype.hasOwnProperty.call(store, o.name);
  const row = el('div', { class: 'opt' + (on ? ' on' : ''), id: 'opt-' + kind + '-' + o.name });
  const head = el('div', { class: 'ohead' });
  const openKey = kind + ':' + o.name;
  head.appendChild(el('button', {
    class: 'oname', type: 'button', title: 'Voir le détail',
    onclick: () => { S.open[openKey] = !S.open[openKey]; save(); render(); }
  }, esc(o.name) + (o.aliases && o.aliases.length ? ' <span class="t">-' + esc(o.aliases[0]) + '</span>' : '')));
  const tags = el('div', { class: 'otags' });
  tags.appendChild(el('span', { class: 't' }, esc(o.type === 'raw' ? 'json' : o.type)));
  if (o.default != null) tags.appendChild(el('span', { class: 't', title: 'Valeur par défaut' }, 'déf. ' + esc(String(o.default).length > 34 ? String(o.default).slice(0, 34) + '…' : o.default)));
  if (o.deprecated) tags.appendChild(el('span', { class: 't err' }, 'déprécié'));
  if (o.avail === '7') tags.appendChild(el('span', { class: 't vi' }, 'TS 7 uniquement'));
  if (o.avail === '5') tags.appendChild(el('span', { class: 't warn' }, 'TS 5 uniquement'));
  head.appendChild(tags);
  head.appendChild(widget(o, store[o.name], v => {
    if (v === undefined) delete store[o.name]; else store[o.name] = v;
    save(); render();
  }));
  row.appendChild(head);
  if (o.short) row.appendChild(el('p', { class: 'osum' }, esc(o.short)));
  if (S.open[openKey]) {
    const d = el('div', { class: 'odet' }, md(o.long || o.short || 'Pas de documentation détaillée.'));
    const lnk = el('div', { class: 'lnk' });
    lnk.appendChild(el('a', { href: 'https://www.typescriptlang.org/tsconfig/#' + encodeURIComponent(o.name), target: '_blank', rel: 'noopener' }, 'Doc TypeScript ↗'));
    if (o.enum) lnk.appendChild(el('span', { class: 't' }, 'valeurs : ' + esc(o.enum.join(', '))));
    d.appendChild(lnk);
    row.appendChild(d);
  }
  return row;
}
function renderTsCompiler(pane) {
  const c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'Version de TypeScript <span class="n">change les options et les valeurs par défaut disponibles</span>'));
  const b = el('div', { class: 'body' });
  const seg = el('div', { class: 'seg' });
  [['7', 'TypeScript ' + VER.ts7], ['5', 'TypeScript ' + VER.ts5], ['all', 'tout afficher']].forEach(([v, l]) => {
    seg.appendChild(el('button', { type: 'button', 'data-v': v, 'aria-pressed': String(S.tsVer === v), onclick: () => { S.tsVer = v; save(); render(); } }, esc(l)));
  });
  b.appendChild(seg);
  b.appendChild(el('p', { class: 'note', style: 'margin:10px 0 0' },
    'TypeScript 7 supprime les cibles et modules legacy (<code>es5</code>, <code>amd</code>, <code>umd</code>, <code>system</code>, <code>none</code>) '
    + 'et change plusieurs valeurs par défaut (<code>strict</code>, <code>esModuleInterop</code>, <code>moduleResolution</code>… — chaque option affiche la sienne). '
    + 'Les options marquées <span class="t warn">TS 5 uniquement</span> ne sont plus reconnues par <code>tsc 7</code>.'));
  c.appendChild(b);
  pane.appendChild(c);

  pane.appendChild(presetCard('ts'));

  const byCat = {};
  TSO.filter(tsVisible).filter(o => matches(S.q, o.name, o.short, o.long, o.category)).forEach(o => { (byCat[o.category] = byCat[o.category] || []).push(o); });
  const cats = CAT_ORDER.filter(c2 => byCat[c2]).concat(Object.keys(byCat).filter(c2 => !CAT_ORDER.includes(c2)));
  if (!cats.length) { pane.appendChild(el('div', { class: 'card' }, '<div class="empty">Aucune option ne correspond à « ' + esc(S.q) + ' »</div>')); return; }
  cats.forEach(cat => {
    const list = byCat[cat].slice().sort((a, b2) => a.name.localeCompare(b2.name));
    const mod = list.filter(o => Object.prototype.hasOwnProperty.call(S.ts, o.name)).length;
    const d = el('details', { class: 'group', open: S.q ? true : (S.open['cat:' + cat] !== false) });
    d.addEventListener('toggle', () => { S.open['cat:' + cat] = d.open; save(); });
    d.appendChild(el('summary', null, esc(cat) + ' <span class="cnt">' + list.length + '</span>' + (mod ? '<span class="mod">' + mod + ' défini(s)</span>' : '')));
    const g = el('div', { class: 'glist' });
    list.forEach(o => g.appendChild(optRow(o, 'ts')));
    d.appendChild(g);
    pane.appendChild(d);
  });
}
function renderTsRoot(pane) {
  let c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'Champs racine de tsconfig.json <span class="n">' + TSROOT.length + '</span>'));
  const b = el('div', { class: 'body' }); b.style.padding = '0';
  TSROOT.filter(o => matches(S.q, o.name, o.long)).forEach(o => b.appendChild(optRow({ name: o.name, type: o.type, short: '', long: o.long, default: o.default, aliases: [], avail: '75' }, 'root')));
  c.appendChild(b); pane.appendChild(c);

  c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'watchOptions <span class="n">' + TSW.length + '</span>'));
  const b2 = el('div', { class: 'body' }); b2.style.padding = '0';
  TSW.filter(o => matches(S.q, o.name, o.short, o.long)).forEach(o => b2.appendChild(optRow({ name: o.name, type: o.type, enum: o.enum, short: o.short, long: o.long, default: o.default, aliases: [], avail: '75' }, 'watch')));
  c.appendChild(b2); pane.appendChild(c);

  c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'typeAcquisition <span class="n">éditeurs / projets JS</span>'));
  const b3 = el('div', { class: 'body' }); b3.style.padding = '0';
  TSACQ.filter(o => matches(S.q, o.name, o.long)).forEach(o => b3.appendChild(optRow({ name: o.name, type: o.type, short: '', long: o.long, default: o.default, aliases: [], avail: '75' }, 'acq')));
  c.appendChild(b3); pane.appendChild(c);
}

/* -------------------------------------------------------- oxlint config tab */
function sevSeg(cur, onChange, withDefault) {
  const s = el('div', { class: 'seg' });
  const vals = (withDefault === false ? [] : [['\u0000', 'défaut']]).concat([['off', 'off'], ['warn', 'warn'], ['error', 'error']]);
  vals.forEach(([v, l]) => s.appendChild(el('button', {
    type: 'button', 'data-v': v === 'off' ? 'allow' : v, 'aria-pressed': String(cur === v || (v === '\u0000' && !cur)),
    onclick: () => onChange(v === '\u0000' ? undefined : v)
  }, l)));
  return s;
}
function renderOxConfig(pane) {
  pane.appendChild(presetCard('ox'));

  /* plugins */
  let c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'plugins <span class="n">' + OXC.plugins.length + ' disponibles — ' + S.ox.plugins.length + ' activé(s)</span>'));
  let b = el('div', { class: 'body' });
  b.appendChild(el('p', { class: 'note' }, 'Par défaut oxlint active <code>eslint</code>, <code>unicorn</code>, <code>typescript</code> et <code>oxc</code>. Dès que le champ <code>plugins</code> est présent, il remplace cette liste.'));
  const chips = el('div', { class: 'chips' });
  OXC.plugins.forEach(p => {
    const n = OXR.filter(r => r.p === p).length;
    chips.appendChild(el('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(S.ox.plugins.includes(p)),
      title: n + ' règles' + (BUILTIN_OX.includes(p) ? ' — activé par défaut' : ''),
      onclick: () => { const i = S.ox.plugins.indexOf(p); i < 0 ? S.ox.plugins.push(p) : S.ox.plugins.splice(i, 1); save(); render(); }
    }, esc(p) + ' <span style="opacity:.65">' + n + '</span>'));
  });
  b.appendChild(chips); c.appendChild(b); pane.appendChild(c);

  /* categories */
  c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'categories <span class="n">règle la sévérité de catégories entières</span>'));
  b = el('div', { class: 'body' }); b.style.padding = '0';
  OX_CATS.forEach(cat => {
    const n = OXR.filter(r => r.c === cat).length;
    const on = !!S.ox.categories[cat];
    const row = el('div', { class: 'opt' + (on ? ' on' : '') });
    const h = el('div', { class: 'ohead' });
    h.appendChild(el('span', { class: 'oname', style: 'cursor:default' }, esc(cat)));
    const tg = el('div', { class: 'otags' });
    tg.appendChild(el('span', { class: 't' }, n + ' règles'));
    if (cat === 'correctness') tg.appendChild(el('span', { class: 't ok' }, 'activée par défaut'));
    if (cat === 'nursery') tg.appendChild(el('span', { class: 't err' }, 'instable'));
    h.appendChild(tg);
    const w = el('span', { class: 'octl' });
    w.appendChild(sevSeg(S.ox.categories[cat], v => { if (v === undefined) delete S.ox.categories[cat]; else S.ox.categories[cat] = v; save(); render(); }));
    h.appendChild(w); row.appendChild(h);
    row.appendChild(el('p', { class: 'osum' }, esc(OX_CAT_DOC[cat] || '')));
    b.appendChild(row);
  });
  c.appendChild(b); pane.appendChild(c);

  /* options */
  c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'options <span class="n">comportement du linter</span>'));
  b = el('div', { class: 'body' }); b.style.padding = '0';
  OXC.options.forEach(o => {
    const on = Object.prototype.hasOwnProperty.call(S.ox.options, o.name);
    const row = el('div', { class: 'opt' + (on ? ' on' : '') });
    const h = el('div', { class: 'ohead' });
    h.appendChild(el('span', { class: 'oname', style: 'cursor:default' }, esc(o.name)));
    const tg = el('div', { class: 'otags' });
    tg.appendChild(el('span', { class: 't' }, esc(o.type === 'enum' && o.enum ? o.enum.join('|') : o.type)));
    if (o.default != null) tg.appendChild(el('span', { class: 't' }, 'déf. ' + esc(JSON.stringify(o.default))));
    h.appendChild(tg);
    const widgetOpt = o.name === 'reportUnusedDisableDirectives'
      ? { type: 'enum', enum: OXC.severities } : o;
    h.appendChild(widget(widgetOpt, S.ox.options[o.name], v => {
      if (v === undefined) delete S.ox.options[o.name]; else S.ox.options[o.name] = v;
      save(); render();
    }));
    row.appendChild(h);
    row.appendChild(el('div', { class: 'osum' }, md(o.doc)));
    b.appendChild(row);
  });
  c.appendChild(b); pane.appendChild(c);

  /* env */
  c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'env <span class="n">' + OXC.envs.length + ' environnements de globales</span>'));
  b = el('div', { class: 'body' });
  b.appendChild(el('p', { class: 'note' }, esc(OXC.envDoc || 'Les environnements activent des collections de variables globales.') + ' Défaut : <code>{ "builtin": true }</code>.'));
  const ec = el('div', { class: 'chips' });
  OXC.envs.forEach(e2 => ec.appendChild(el('button', {
    type: 'button', class: 'chip', title: e2.doc, 'aria-pressed': String(!!S.ox.env[e2.name]),
    onclick: () => { if (S.ox.env[e2.name]) delete S.ox.env[e2.name]; else S.ox.env[e2.name] = true; save(); render(); }
  }, esc(e2.name))));
  b.appendChild(ec);
  b.appendChild(el('div', { class: 'field', style: 'margin-top:12px' }, '<span>globals — JSON <code>{ "maVar": "readonly" | "writable" | "off" }</code></span>'));
  const gta = el('textarea', {
    spellcheck: 'false', placeholder: '{\n  "MY_GLOBAL": "readonly"\n}',
    oninput: e3 => {
      const v = e3.target.value.trim();
      if (!v) { S.ox.globals = {}; gta.style.borderColor = ''; save(); genOut(); return; }
      try { S.ox.globals = JSON.parse(v); gta.style.borderColor = ''; save(); genOut(); }
      catch (err) { gta.style.borderColor = 'var(--err)'; }
    }
  });
  gta.value = Object.keys(S.ox.globals || {}).length ? JSON.stringify(S.ox.globals, null, 2) : '';
  b.appendChild(gta);
  c.appendChild(b); pane.appendChild(c);

  /* ignorePatterns + extends + overrides */
  c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'ignorePatterns · extends · overrides'));
  b = el('div', { class: 'body' });
  const f1 = el('div', { class: 'field' }, '<span>ignorePatterns — un motif glob par ligne</span>');
  const ip = el('textarea', { spellcheck: 'false', placeholder: 'dist/**\ncoverage/**\n**/*.generated.ts', oninput: e4 => { S.ox.ignorePatterns = e4.target.value.split('\n').map(x => x.trim()).filter(Boolean); save(); genOut(); } });
  ip.value = (S.ox.ignorePatterns || []).join('\n'); f1.appendChild(ip); b.appendChild(f1);
  const f2 = el('div', { class: 'field', style: 'margin-top:10px' }, '<span>extends — chemins de configs héritées, un par ligne</span>');
  const ex = el('textarea', { spellcheck: 'false', placeholder: './.oxlintrc.base.json', oninput: e5 => { S.ox.extends = e5.target.value.split('\n').map(x => x.trim()).filter(Boolean); save(); genOut(); } });
  ex.value = (S.ox.extends || []).join('\n'); f2.appendChild(ex); b.appendChild(f2);
  const f3 = el('div', { class: 'field', style: 'margin-top:10px' }, '<span>overrides — tableau JSON <code>[{ "files": ["**/*.test.ts"], "rules": { … } }]</code></span>');
  const ov = el('textarea', {
    spellcheck: 'false', placeholder: '[\n  { "files": ["**/*.test.ts"], "plugins": ["vitest"], "rules": { "vitest/no-focused-tests": "error" } }\n]',
    oninput: e6 => { S.ox.overrides = e6.target.value; const v = e6.target.value.trim(); if (!v) { ov.style.borderColor = ''; save(); genOut(); return; } try { JSON.parse(v); ov.style.borderColor = ''; } catch (err) { ov.style.borderColor = 'var(--err)'; } save(); genOut(); }
  });
  ov.value = S.ox.overrides || ''; f3.appendChild(ov); b.appendChild(f3);
  c.appendChild(b); pane.appendChild(c);

  /* settings */
  c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'settings <span class="n">réglages par plugin</span>'));
  b = el('div', { class: 'body' }); b.style.padding = '0';
  OXC.settings.forEach(s2 => {
    const d = el('details', { class: 'group', style: 'margin:10px 12px', open: S.open['set:' + s2.plugin] === true });
    d.addEventListener('toggle', () => { S.open['set:' + s2.plugin] = d.open; save(); });
    const nset = Object.keys((S.ox.settings[s2.plugin]) || {}).length;
    d.appendChild(el('summary', null, '<span style="font-family:var(--mono)">' + esc(s2.plugin) + '</span> <span class="cnt">' + s2.props.length + '</span>' + (nset ? '<span class="mod">' + nset + ' défini(s)</span>' : '')));
    const g = el('div', { class: 'glist' });
    s2.props.forEach(p => {
      S.ox.settings[s2.plugin] = S.ox.settings[s2.plugin] || {};
      const store = S.ox.settings[s2.plugin];
      const on = Object.prototype.hasOwnProperty.call(store, p.name);
      const row = el('div', { class: 'opt' + (on ? ' on' : '') });
      const h = el('div', { class: 'ohead' });
      h.appendChild(el('span', { class: 'oname', style: 'cursor:default' }, esc(p.name)));
      const tg = el('div', { class: 'otags' });
      tg.appendChild(el('span', { class: 't' }, esc(p.type === 'raw' ? 'json' : p.type)));
      if (p.default != null) tg.appendChild(el('span', { class: 't' }, 'déf. ' + esc(JSON.stringify(p.default)).slice(0, 40)));
      h.appendChild(tg);
      h.appendChild(widget(p, store[p.name], v => { if (v === undefined) delete store[p.name]; else store[p.name] = v; save(); render(); }));
      row.appendChild(h);
      if (p.doc) row.appendChild(el('div', { class: 'osum' }, md(p.doc)));
      g.appendChild(row);
    });
    d.appendChild(g); b.appendChild(d);
  });
  c.appendChild(b); pane.appendChild(c);
}

/* --------------------------------------------------------- oxlint rules tab */
const FIX_GROUPS = {
  any: f => f !== 'none' && f !== 'pending',
  safe: f => /^(fixable|conditional)_(safe_)?(fix|fix_or_suggestion)$/.test(f) || f === 'fixable_fix' || f === 'conditional_fix' || f === 'fixable_safe_fix_or_suggestion' || f === 'conditional_safe_fix_or_suggestion',
  dangerous: f => f.includes('dangerous'),
  none: f => f === 'none' || f === 'pending'
};
function filteredRules() {
  const f = S.f;
  return OXR.filter(r => {
    if (f.plugin && r.p !== f.plugin) return false;
    if (f.cat && r.c !== f.cat) return false;
    if (f.fix && !FIX_GROUPS[f.fix](r.f)) return false;
    if (f.ta === 'yes' && !r.t) return false;
    if (f.ta === 'no' && r.t) return false;
    if (f.def === 'yes' && !r.d) return false;
    if (f.def === 'no' && r.d) return false;
    const touched = !!S.ox.rules[r.k] || !!S.ox.ruleOpts[r.k] || !!S.ox.rulePos[r.k];
    if (f.sel === 'yes' && !touched) return false;
    if (f.sel === 'no' && touched) return false;
    if (f.opt === 'yes' && !((r.op || []).length + (r.ap || []).length)) return false;
    if (f.plugin === '' && f.src === 'active' && !S.ox.plugins.includes(r.p)) return false;
    if (!matches(S.q, r.k, r.n, r.p, r.w, r.y, (r.op || []).map(o => o.name).join(' '))) return false;
    return true;
  });
}
function ruleRow(r) {
  const key = r.k, sev = S.ox.rules[key], opts = S.ox.ruleOpts[key] || {};
  const pos = S.ox.rulePos[key] || {};
  const nOpts = Object.keys(opts).length + Object.keys(pos).length;
  const on = !!sev || nOpts > 0;
  const row = el('div', { class: 'rule' + (on ? ' on' : '') });
  const h = el('div', { class: 'rhead' });
  const openKey = 'r:' + key;
  h.appendChild(el('button', {
    class: 'rname', type: 'button',
    onclick: () => { S.open[openKey] = !S.open[openKey]; save(); render(); }
  }, (r.p !== 'eslint' ? '<span class="sc">' + esc(r.p) + '/</span>' : '') + esc(r.n)));
  const tg = el('div', { class: 'otags' });
  const catCls = { correctness: 'err', suspicious: 'warn', pedantic: 'ac', perf: 'vi', style: '', restriction: '', nursery: 'warn' }[r.c] || '';
  tg.appendChild(el('span', { class: 't ' + catCls }, esc(r.c)));
  if (r.d) tg.appendChild(el('span', { class: 't ok', title: 'Activée par défaut' }, 'défaut ✓'));
  if (r.t) tg.appendChild(el('span', { class: 't vi', title: 'Nécessite les infos de type (oxlint-tsgolint + options.typeAware)' }, 'type-aware'));
  if (r.f !== 'none') tg.appendChild(el('span', { class: 't' + (r.f.includes('dangerous') ? ' warn' : ' ok'), title: (FIX_DOC[r.f] || ['', ''])[1] }, esc((FIX_DOC[r.f] || [r.f])[0])));
  const nAvail = (r.op || []).length + (r.ap || []).length;
  if (nAvail) tg.appendChild(el('span', { class: 't ac' }, nAvail + ' option' + (nAvail > 1 ? 's' : '') + ((r.ap || []).length ? ' pos.' : '')));
  if (nOpts) tg.appendChild(el('span', { class: 't ac' }, nOpts + ' réglée(s)'));
  h.appendChild(tg);
  const w = el('span', { class: 'octl' });
  w.appendChild(sevSeg(sev, v => { if (v === undefined) delete S.ox.rules[key]; else S.ox.rules[key] = v; save(); render(); }));
  h.appendChild(w);
  row.appendChild(h);
  if (!S.open[openKey]) {
    row.appendChild(el('p', { class: 'osum' }, esc((r.w || '').replace(/\n/g, ' ').slice(0, 170) + ((r.w || '').length > 170 ? '…' : ''))));
    return row;
  }
  const d = el('div', { class: 'odet' });
  d.appendChild(el('div', null, '<strong>Ce que fait la règle</strong>' + md(r.w)));
  if (r.y) d.appendChild(el('div', null, '<strong>Pourquoi c’est un problème</strong>' + md(r.y)));
  if (r.f !== 'none' && FIX_DOC[r.f]) d.appendChild(el('p', null, '<strong>Auto-fix :</strong> ' + esc(FIX_DOC[r.f][1])));
  if (r.t) d.appendChild(el('p', null, '<strong>Type-aware :</strong> nécessite <code>"options": { "typeAware": true }</code> et le paquet <code>oxlint-tsgolint</code>.'));
  if (r.oi) d.appendChild(el('p', null, md(r.oi)));
  if (r.ap && r.ap.length) {
    d.appendChild(el('p', null, '<strong>Options positionnelles</strong> — passées après la sévérité : <code>["error", option 1, option 2]</code>.'));
    const box = el('div', { class: 'ropts' });
    r.ap.forEach(p => {
      const o = el('div', { class: 'ropt' });
      const rh = el('div', { class: 'rh' });
      rh.appendChild(el('span', { class: 'rn' }, esc(p.name)));
      rh.appendChild(el('span', { class: 't' }, esc(p.typeRaw || p.type)));
      if (p.default != null) rh.appendChild(el('span', { class: 't' }, 'déf. ' + esc(p.default)));
      rh.appendChild(widget(p, pos[p.i], v => {
        S.ox.rulePos[key] = S.ox.rulePos[key] || {};
        if (v === undefined) delete S.ox.rulePos[key][p.i]; else S.ox.rulePos[key][p.i] = v;
        if (!Object.keys(S.ox.rulePos[key]).length) delete S.ox.rulePos[key];
        save(); render();
      }));
      o.appendChild(rh);
      if (p.doc) o.appendChild(el('div', { class: 'rd' }, md(p.doc)));
      box.appendChild(o);
    });
    d.appendChild(box);
  }
  if (r.op && r.op.length) {
    const box = el('div', { class: 'ropts' });
    r.op.forEach(p => {
      const cur = opts[p.name];
      const o = el('div', { class: 'ropt' });
      const rh = el('div', { class: 'rh' });
      rh.appendChild(el('span', { class: 'rn' }, esc(p.name)));
      rh.appendChild(el('span', { class: 't' }, esc(p.typeRaw || p.type)));
      if (p.default != null) rh.appendChild(el('span', { class: 't' }, 'déf. ' + esc(p.default)));
      rh.appendChild(widget(p, cur, v => {
        S.ox.ruleOpts[key] = S.ox.ruleOpts[key] || {};
        if (v === undefined) delete S.ox.ruleOpts[key][p.name]; else S.ox.ruleOpts[key][p.name] = v;
        if (!Object.keys(S.ox.ruleOpts[key]).length) delete S.ox.ruleOpts[key];
        save(); render();
      }));
      o.appendChild(rh);
      if (p.doc) o.appendChild(el('div', { class: 'rd' }, md(p.doc)));
      box.appendChild(o);
    });
    d.appendChild(box);
  }
  const lnk = el('div', { class: 'lnk' });
  lnk.appendChild(el('a', { href: r.u, target: '_blank', rel: 'noopener' }, 'Doc oxlint ↗'));
  if (r.up) lnk.appendChild(el('a', { href: r.up, target: '_blank', rel: 'noopener' }, 'Règle d’origine ↗'));
  if (r.v) lnk.appendChild(el('span', { class: 't' }, 'depuis oxlint v' + esc(r.v)));
  lnk.appendChild(el('span', { class: 't' }, 'clé : ' + esc(r.k)));
  d.appendChild(lnk);
  row.appendChild(d);
  return row;
}
let shown = 160;
function renderOxRules(pane) {
  const list = filteredRules();
  const c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'Règles oxlint <span class="n">' + list.length + ' / ' + OXR.length + ' — ' + Object.keys(S.ox.rules).length + ' réglée(s), '
    + (new Set(Object.keys(S.ox.ruleOpts).concat(Object.keys(S.ox.rulePos)))).size + ' avec options</span>'));
  const fb = el('div', { class: 'filters' });
  const sel = (label, key, options) => {
    const s = el('select', { onchange: e => { S.f[key] = e.target.value; shown = 160; save(); render(); } });
    options.forEach(([v, l]) => s.appendChild(el('option', { value: v, selected: S.f[key] === v }, esc(l))));
    const wrap = el('label', { class: 'ck' }); wrap.appendChild(el('span', null, esc(label))); wrap.appendChild(s);
    return wrap;
  };
  fb.appendChild(sel('plugin', 'plugin', [['', 'tous (' + OXR.length + ')']].concat(OXC.plugins.map(p => [p, p + ' (' + OXR.filter(r => r.p === p).length + ')']))));
  fb.appendChild(sel('catégorie', 'cat', [['', 'toutes']].concat(OX_CATS.map(x => [x, x + ' (' + OXR.filter(r => r.c === x).length + ')']))));
  fb.appendChild(sel('fix', 'fix', [['', 'peu importe'], ['any', 'auto-fixable'], ['safe', 'fix sûr'], ['dangerous', 'fix risqué'], ['none', 'aucun fix']]));
  fb.appendChild(sel('type-aware', 'ta', [['', 'peu importe'], ['yes', 'oui'], ['no', 'non']]));
  fb.appendChild(sel('par défaut', 'def', [['', 'peu importe'], ['yes', 'activée'], ['no', 'désactivée']]));
  fb.appendChild(sel('réglée', 'sel', [['', 'peu importe'], ['yes', 'oui'], ['no', 'non']]));
  fb.appendChild(sel('plugins', 'src', [['', 'tous les plugins'], ['active', 'plugins activés seulement']]));
  fb.appendChild(sel('options', 'opt', [['', 'peu importe'], ['yes', 'configurables']]));
  fb.appendChild(el('button', { class: 'iconbtn', onclick: () => { S.f = fresh().f; shown = 160; save(); render(); } }, 'Filtres ✕'));
  const bulk = el('div', { class: 'filters', style: 'top:auto;position:static' });
  bulk.appendChild(el('span', { class: 'note', style: 'margin:0' }, 'Appliquer à ces ' + list.length + ' règle(s) :'));
  [['error', 'error'], ['warn', 'warn'], ['off', 'off']].forEach(([v, l]) => bulk.appendChild(el('button', {
    class: 'iconbtn', onclick: () => { list.forEach(r => { S.ox.rules[r.k] = v; }); save(); render(); flash(list.length + ' règles → ' + l); }
  }, l)));
  bulk.appendChild(el('button', { class: 'iconbtn', onclick: () => { list.forEach(r => { delete S.ox.rules[r.k]; delete S.ox.ruleOpts[r.k]; delete S.ox.rulePos[r.k]; }); save(); render(); flash('Remis par défaut'); } }, 'défaut'));
  c.appendChild(fb); c.appendChild(bulk);
  const body = el('div');
  if (!list.length) body.appendChild(el('div', { class: 'empty' }, 'Aucune règle ne correspond aux filtres.'));
  list.slice(0, shown).forEach(r => body.appendChild(ruleRow(r)));
  c.appendChild(body);
  if (list.length > shown) c.appendChild(el('button', { class: 'btn sec more', onclick: () => { shown += 300; render(); } }, 'Afficher 300 règles de plus (' + (list.length - shown) + ' restantes)'));
  pane.appendChild(c);
}

/* ------------------------------------------------------------- project tab */
const PMS = {
  npm: { add: 'npm i -D', run: 'npm run', x: 'npx' },
  pnpm: { add: 'pnpm add -D', run: 'pnpm', x: 'pnpm dlx' },
  yarn: { add: 'yarn add -D', run: 'yarn', x: 'yarn dlx' },
  bun: { add: 'bun add -d', run: 'bun run', x: 'bunx' }
};
function renderPkg(pane) {
  const c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'Projet <span class="n">gestionnaire de paquets, versions, scripts</span>'));
  const b = el('div', { class: 'body' });
  const g = el('div', { class: 'grid2' });
  const f1 = el('div', { class: 'field' }, '<span>gestionnaire de paquets</span>');
  const seg = el('div', { class: 'seg' });
  Object.keys(PMS).forEach(p => seg.appendChild(el('button', { type: 'button', 'aria-pressed': String(S.pkg.pm === p), onclick: () => { S.pkg.pm = p; save(); render(); } }, p)));
  f1.appendChild(seg); g.appendChild(f1);
  const f2 = el('div', { class: 'field' }, '<span>version de typescript</span>');
  const s2 = el('select', { onchange: e => { S.pkg.tsLine = e.target.value; save(); render(); } });
  [['7', '^' + VER.ts7 + '  (TypeScript 7)'], ['5', '^' + VER.ts5 + '  (TypeScript 5)']].forEach(([v, l]) => s2.appendChild(el('option', { value: v, selected: S.pkg.tsLine === v }, esc(l))));
  f2.appendChild(s2); g.appendChild(f2);
  b.appendChild(g);
  b.appendChild(el('label', { class: 'ck', style: 'margin-top:12px' })).appendChild(el('input', { type: 'checkbox', checked: S.pkg.scripts, onchange: e => { S.pkg.scripts = e.target.checked; save(); render(); } }));
  b.lastChild.appendChild(el('span', null, 'inclure les scripts npm (typecheck, lint, lint:fix)'));
  const ta = el('label', { class: 'ck', style: 'display:flex;margin-top:8px' });
  ta.appendChild(el('input', { type: 'checkbox', checked: S.pkg.oxTypeAware, onchange: e => { S.pkg.oxTypeAware = e.target.checked; save(); render(); } }));
  ta.appendChild(el('span', null, 'activer le lint type-aware d’oxlint (ajoute <code>oxlint-tsgolint</code> et <code>options.typeAware</code>)'));
  b.appendChild(ta);
  const taRules = OXR.filter(r => r.t).length;
  b.appendChild(el('p', { class: 'note', style: 'margin:10px 0 0' }, taRules + ' règles nécessitent les informations de type. Sans <code>typeAware</code>, elles ne s’exécutent pas même réglées sur <code>error</code>.'));
  c.appendChild(b); pane.appendChild(c);

  const c2 = el('div', { class: 'card' });
  c2.appendChild(el('h2', null, 'Récapitulatif'));
  const b2 = el('div', { class: 'body' });
  const nTs = Object.keys(S.ts).length, nRoot = Object.keys(S.tsRoot).length + Object.keys(S.tsWatch).length + Object.keys(S.tsAcq).length;
  const nR = Object.keys(S.ox.rules).length, nRo = Object.keys(S.ox.ruleOpts).length;
  const rows = [
    ['compilerOptions définies', nTs + ' / ' + TSO.filter(tsVisible).length],
    ['champs racine / watch / typeAcquisition', String(nRoot)],
    ['plugins oxlint', S.ox.plugins.join(', ') || '(aucun — oxlint gardera ses défauts)'],
    ['catégories réglées', Object.entries(S.ox.categories).map(([k, v]) => k + ':' + v).join(', ') || '—'],
    ['règles réglées individuellement', String(nR)],
    ['règles avec options', String(nRo + Object.keys(S.ox.rulePos).length)],
    ['environnements', Object.keys(S.ox.env).join(', ') || '—']
  ];
  const tbl = el('div');
  rows.forEach(([k, v]) => {
    const r = el('div', { style: 'display:flex;gap:10px;padding:6px 0;border-top:1px solid var(--bd)' });
    r.appendChild(el('span', { style: 'color:var(--fg2);min-width:16ch;flex:0 0 auto' }, esc(k)));
    r.appendChild(el('span', { style: 'font-family:var(--mono);font-size:12.5px' }, esc(v)));
    tbl.appendChild(r);
  });
  b2.appendChild(tbl); c2.appendChild(b2); pane.appendChild(c2);
}

/* ------------------------------------------------------------- presets */
const TS_PRESETS = [
  {
    id: 'app-bundler', name: 'App web (bundler)', desc: 'Vite / Next / Rollup — strict, noEmit, moderne',
    ts: {
      target: 'es2022', lib: ['es2023', 'dom', 'dom.iterable'], module: 'esnext', moduleResolution: 'bundler',
      moduleDetection: 'force', jsx: 'react-jsx', strict: true, noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true, noImplicitOverride: true, noFallthroughCasesInSwitch: true,
      noUnusedLocals: true, noUnusedParameters: true, verbatimModuleSyntax: true, isolatedModules: true,
      erasableSyntaxOnly: true, allowImportingTsExtensions: true, resolveJsonModule: true,
      esModuleInterop: true, skipLibCheck: true, noEmit: true, forceConsistentCasingInFileNames: true, useDefineForClassFields: true
    },
    root: { include: ['src'], exclude: ['node_modules', 'dist'] }
  },
  {
    id: 'node', name: 'Node.js ESM', desc: 'nodenext, émission réelle vers dist/',
    ts: {
      target: 'es2024', lib: ['es2024'], module: 'nodenext', moduleResolution: 'nodenext', types: ['node'],
      strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noImplicitOverride: true,
      noFallthroughCasesInSwitch: true, noUnusedLocals: true, noUnusedParameters: true,
      verbatimModuleSyntax: true, erasableSyntaxOnly: true, outDir: 'dist', rootDir: 'src',
      sourceMap: true, declaration: true, declarationMap: true, skipLibCheck: true, esModuleInterop: true, incremental: true
    },
    root: { include: ['src'], exclude: ['node_modules', 'dist', '**/*.test.ts'] }
  },
  {
    id: 'lib', name: 'Librairie publiable', desc: 'd.ts, isolatedDeclarations, double sortie propre',
    ts: {
      target: 'es2022', lib: ['es2023'], module: 'nodenext', moduleResolution: 'nodenext',
      strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
      declaration: true, declarationMap: true, isolatedDeclarations: true, sourceMap: true,
      outDir: 'dist', rootDir: 'src', stripInternal: true, verbatimModuleSyntax: true,
      erasableSyntaxOnly: true, skipLibCheck: true, noUnusedLocals: true, noUnusedParameters: true, removeComments: false
    },
    root: { include: ['src'], exclude: ['node_modules', 'dist', '**/*.test.ts'] }
  },
  {
    id: 'mono', name: 'Monorepo (project references)', desc: 'composite + incremental — ajoute tes references dans l’onglet racine',
    ts: {
      composite: true, incremental: true, declaration: true, declarationMap: true, sourceMap: true,
      tsBuildInfoFile: './node_modules/.cache/tsconfig.tsbuildinfo', rootDir: 'src', outDir: 'dist',
      module: 'nodenext', moduleResolution: 'nodenext', target: 'es2022', strict: true,
      noUncheckedIndexedAccess: true, skipLibCheck: true, verbatimModuleSyntax: true
    },
    root: { include: ['src'], exclude: ['node_modules', 'dist'] }
  },
  {
    id: 'max', name: 'Maximum de rigueur', desc: 'tous les contrôles stricts explicitement activés',
    ts: (() => {
      const o = {
        target: 'es2024', module: 'nodenext', moduleResolution: 'nodenext', strict: true, skipLibCheck: false,
        allowUnreachableCode: false, allowUnusedLabels: false
      };
      ['alwaysStrict', 'noImplicitAny', 'noImplicitThis', 'strictBindCallApply', 'strictBuiltinIteratorReturn',
        'strictFunctionTypes', 'strictNullChecks', 'strictPropertyInitialization', 'useUnknownInCatchVariables',
        'exactOptionalPropertyTypes', 'noFallthroughCasesInSwitch', 'noImplicitOverride', 'noImplicitReturns',
        'noPropertyAccessFromIndexSignature', 'noUncheckedIndexedAccess', 'noUnusedLocals', 'noUnusedParameters',
        'forceConsistentCasingInFileNames', 'isolatedModules', 'verbatimModuleSyntax', 'erasableSyntaxOnly',
        'noUncheckedSideEffectImports', 'useDefineForClassFields', 'noEmitOnError'].forEach(k => { if (TSOByName[k]) o[k] = true; });
      return o;
    })(),
    root: { include: ['src'], exclude: ['node_modules', 'dist'] }
  },
  { id: 'min', name: 'Minimal', desc: 'juste de quoi démarrer', ts: { target: 'es2022', module: 'nodenext', strict: true }, root: { include: ['src'] } }
];
const OX_PRESETS = [
  {
    id: 'reco', name: 'Recommandé', desc: 'defaults oxlint + correctness en error',
    ox: { plugins: ['eslint', 'typescript', 'unicorn', 'oxc'], categories: { correctness: 'error' }, env: { builtin: true }, options: {} }
  },
  {
    id: 'strict-ts', name: 'TypeScript strict', desc: 'correctness+suspicious en error, pedantic/perf en warn, import activé',
    ox: {
      plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'import', 'promise'],
      categories: { correctness: 'error', suspicious: 'error', pedantic: 'warn', perf: 'warn' },
      env: { builtin: true, node: true },
      options: { denyWarnings: false },
      rules: { 'no-console': 'warn', 'typescript/no-explicit-any': 'error', 'typescript/consistent-type-imports': 'error', 'import/no-cycle': 'error', 'eqeqeq': 'error' }
    }
  },
  {
    id: 'react', name: 'React / Next', desc: 'react, react-hooks, jsx-a11y, react-perf, nextjs',
    ox: {
      plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'react', 'jsx-a11y', 'react-perf', 'nextjs', 'import'],
      categories: { correctness: 'error', suspicious: 'error', pedantic: 'warn' },
      env: { builtin: true, browser: true },
      rules: { 'react/rules-of-hooks': 'error', 'react/exhaustive-deps': 'error', 'react/jsx-key': 'error' }
    }
  },
  {
    id: 'vue', name: 'Vue', desc: 'plugin vue + navigateur',
    ox: { plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'vue', 'import'], categories: { correctness: 'error', suspicious: 'error' }, env: { builtin: true, browser: true, vue: true } }
  },
  {
    id: 'node', name: 'Node / backend', desc: 'plugins node, import, promise',
    ox: { plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'node', 'import', 'promise'], categories: { correctness: 'error', suspicious: 'error', perf: 'warn' }, env: { builtin: true, node: true, commonjs: false } }
  },
  {
    id: 'tests', name: 'Tests (vitest + jest)', desc: 'plugins de test activés',
    ox: { plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'vitest', 'jest'], categories: { correctness: 'error', suspicious: 'warn' }, env: { builtin: true, node: true, vitest: true, jest: true } }
  },
  {
    id: 'all', name: 'Tout (sauf nursery)', desc: 'toutes les catégories en error, tous les plugins',
    ox: {
      plugins: OXC.plugins.slice(),
      categories: { correctness: 'error', suspicious: 'error', pedantic: 'error', perf: 'error', style: 'error', restriction: 'error' },
      env: { builtin: true }
    }
  }
];
function presetCard(kind) {
  const c = el('div', { class: 'card' });
  c.appendChild(el('h2', null, 'Préréglages <span class="n">un point de départ, tout reste modifiable</span>'));
  const b = el('div', { class: 'body' });
  const box = el('div', { class: 'presets' });
  (kind === 'ts' ? TS_PRESETS : OX_PRESETS).forEach(p => box.appendChild(el('button', {
    class: 'preset', onclick: () => { applyPreset(kind, p); }
  }, '<b>' + esc(p.name) + '</b><span>' + esc(p.desc) + '</span>')));
  b.appendChild(box);
  c.appendChild(b);
  return c;
}
function applyPreset(kind, p) {
  if (kind === 'ts') {
    S.ts = {}; S.tsRoot = {};
    for (const k in p.ts) if (TSOByName[k]) S.ts[k] = p.ts[k];
    for (const k in (p.root || {})) S.tsRoot[k] = p.root[k];
  } else {
    const f = fresh().ox;
    S.ox = Object.assign(f, { plugins: (p.ox.plugins || BUILTIN_OX).slice(), categories: Object.assign({}, p.ox.categories), env: Object.assign({}, p.ox.env), options: Object.assign({}, p.ox.options), rules: Object.assign({}, p.ox.rules) });
  }
  save(); render(); flash('Préréglage « ' + p.name + ' » appliqué');
}

/* ------------------------------------------------------------- generators */
const jstr = (v, indent) => JSON.stringify(v, null, 2).split('\n').map((l, i) => (i === 0 ? l : indent + l)).join('\n');
function member(key, value, indent, comment) {
  const pre = (S.comments && comment) ? String(comment).replace(/\s*\n\s*/g, ' ').match(/.{1,96}(\s|$)/g).map(x => indent + '// ' + x.trim()).join('\n') + '\n' : '';
  return pre + indent + JSON.stringify(key) + ': ' + jstr(value, indent);
}
function genTsconfig() {
  const top = [];
  top.push('  ' + JSON.stringify('$schema') + ': ' + JSON.stringify('https://json.schemastore.org/tsconfig'));
  if (S.tsRoot.extends !== undefined) top.push(member('extends', S.tsRoot.extends, '  ', 'Hérite d’une configuration de base.'));
  const keys = Object.keys(S.ts);
  if (keys.length) {
    const inner = [];
    const byCat = {};
    keys.forEach(k => { const o = TSOByName[k]; (byCat[o ? o.category : 'Other'] = byCat[o ? o.category : 'Other'] || []).push(k); });
    const cats = CAT_ORDER.filter(c => byCat[c]).concat(Object.keys(byCat).filter(c => !CAT_ORDER.includes(c)));
    cats.forEach(cat => {
      const list = byCat[cat].sort();
      let first = true;
      list.forEach(k => {
        const o = TSOByName[k] || {};
        let m = member(k, S.ts[k], '    ', o.short);
        if (S.comments && first) m = '    /* ' + cat + ' */\n' + m;
        first = false;
        inner.push(m);
      });
    });
    top.push('  "compilerOptions": {\n' + inner.join(',\n') + '\n  }');
  }
  ['files', 'include', 'exclude', 'references', 'compileOnSave'].forEach(k => {
    if (S.tsRoot[k] !== undefined) {
      const r = TSROOT.find(x => x.name === k);
      top.push(member(k, S.tsRoot[k], '  ', r && r.long ? r.long.split('\n')[0] : ''));
    }
  });
  if (Object.keys(S.tsWatch).length) {
    const inner = Object.keys(S.tsWatch).sort().map(k => {
      const o = TSW.find(x => x.name === k);
      return member(k, S.tsWatch[k], '    ', o && o.short);
    });
    top.push('  "watchOptions": {\n' + inner.join(',\n') + '\n  }');
  }
  if (Object.keys(S.tsAcq).length) {
    const inner = Object.keys(S.tsAcq).sort().map(k => member(k, S.tsAcq[k], '    ', ''));
    top.push('  "typeAcquisition": {\n' + inner.join(',\n') + '\n  }');
  }
  return '{\n' + top.join(',\n') + '\n}\n';
}
function ruleValue(key) {
  const sev = S.ox.rules[key], opts = S.ox.ruleOpts[key], pos = S.ox.rulePos[key];
  const r = OXR.find(x => x.k === key);
  const args = [];
  if (pos && Object.keys(pos).length && r && r.ap && r.ap.length) {
    const max = Math.max.apply(null, Object.keys(pos).map(Number));
    for (let i = 0; i <= max; i++) {
      if (pos[i] !== undefined) { args.push(pos[i]); continue; }
      // never leave a hole: fall back to the documented default, else stop here
      const slot = r.ap.find(x => x.i === i);
      let def;
      if (slot && slot.default != null) { try { def = JSON.parse(slot.default); } catch (e) { def = slot.default; } }
      if (def === undefined) break;
      args.push(def);
    }
  }
  if (opts && Object.keys(opts).length) args.push(opts);
  if (!args.length) return sev;
  return [sev || 'error'].concat(args);
}
function genOxlintrc() {
  const top = [];
  top.push('  "$schema": "./node_modules/oxlint/configuration_schema.json"');
  if ((S.ox.extends || []).length) top.push(member('extends', S.ox.extends, '  ', 'Configurations héritées, appliquées avant ce fichier.'));
  if (S.ox.plugins.length) top.push(member('plugins', S.ox.plugins.slice().sort(), '  ', 'Remplace la liste de plugins par défaut (eslint, unicorn, typescript, oxc).'));
  if (Object.keys(S.ox.categories).length) {
    const inner = OX_CATS.filter(c => S.ox.categories[c]).map(c => member(c, S.ox.categories[c], '    ', OX_CAT_DOC[c]));
    top.push('  "categories": {\n' + inner.join(',\n') + '\n  }');
  }
  if (Object.keys(S.ox.env).length) top.push(member('env', S.ox.env, '  ', 'Collections de variables globales prédéfinies.'));
  if (Object.keys(S.ox.globals || {}).length) top.push(member('globals', S.ox.globals, '  ', 'Globales supplémentaires : readonly | writable | off.'));
  const opts = Object.assign({}, S.ox.options);
  if (S.pkg.oxTypeAware) opts.typeAware = true;
  if (Object.keys(opts).length) {
    const inner = Object.keys(opts).sort().map(k => {
      const o = OXC.options.find(x => x.name === k);
      return member(k, opts[k], '    ', o && o.doc);
    });
    top.push('  "options": {\n' + inner.join(',\n') + '\n  }');
  }
  const st = {};
  for (const p in S.ox.settings) if (Object.keys(S.ox.settings[p]).length) st[p] = S.ox.settings[p];
  if (Object.keys(st).length) top.push(member('settings', st, '  ', 'Réglages par plugin.'));
  if ((S.ox.ignorePatterns || []).length) top.push(member('ignorePatterns', S.ox.ignorePatterns, '  ', 'Fichiers et dossiers exclus du lint.'));
  const rkeys = Array.from(new Set(Object.keys(S.ox.rules).concat(Object.keys(S.ox.ruleOpts), Object.keys(S.ox.rulePos))));
  if (rkeys.length) {
    const byPlugin = {};
    rkeys.forEach(k => {
      const r = OXR.find(x => x.k === k);
      const p = r ? r.p : 'autre';
      (byPlugin[p] = byPlugin[p] || []).push(k);
    });
    const inner = [];
    Object.keys(byPlugin).sort().forEach(p => {
      let first = true;
      byPlugin[p].sort().forEach(k => {
        const r = OXR.find(x => x.k === k);
        let m = member(k, ruleValue(k), '    ', r && r.w);
        if (S.comments && first) m = '    /* ' + p + ' */\n' + m;
        first = false;
        inner.push(m);
      });
    });
    top.push('  "rules": {\n' + inner.join(',\n') + '\n  }');
  }
  if ((S.ox.overrides || '').trim()) {
    try { top.push(member('overrides', JSON.parse(S.ox.overrides), '  ', 'Réglages spécifiques à certains fichiers.')); } catch (e) {}
  }
  return '{\n' + top.join(',\n') + '\n}\n';
}
function genPackage() {
  const tsv = S.pkg.tsLine === '7' ? VER.ts7 : VER.ts5;
  const dev = { oxlint: '^' + VER.ox, typescript: '^' + tsv };
  if (S.pkg.oxTypeAware) dev['oxlint-tsgolint'] = 'latest';
  const o = { name: 'mon-projet', private: true, type: 'module', packageManager: undefined, devDependencies: {} };
  delete o.packageManager;
  if (S.pkg.scripts) o.scripts = { typecheck: 'tsc --noEmit', lint: 'oxlint' + (S.pkg.oxTypeAware ? ' --type-aware' : ''), 'lint:fix': 'oxlint --fix' + (S.pkg.oxTypeAware ? ' --type-aware' : ''), check: 'npm run typecheck && npm run lint' };
  Object.keys(dev).sort().forEach(k => { o.devDependencies[k] = dev[k]; });
  return JSON.stringify(o, null, 2) + '\n';
}
function genCommands() {
  const pm = PMS[S.pkg.pm];
  const deps = ['typescript@' + (S.pkg.tsLine === '7' ? VER.ts7 : VER.ts5), 'oxlint@' + VER.ox].concat(S.pkg.oxTypeAware ? ['oxlint-tsgolint'] : []);
  const L = [];
  L.push('# 1. Dépendances');
  L.push(pm.add + ' ' + deps.join(' '));
  L.push('');
  L.push('# 2. Fichiers de configuration');
  L.push('#    colle l’onglet tsconfig.json       -> ./tsconfig.json');
  L.push('#    colle l’onglet .oxlintrc.json      -> ./.oxlintrc.json');
  L.push('');
  L.push('# 3. Vérifier');
  L.push(pm.run + ' typecheck     # ' + (S.pkg.tsLine === '7' ? 'tsc 7' : 'tsc 5') + ' sans émission');
  L.push(pm.run + ' lint');
  L.push(pm.run + ' lint:fix');
  L.push('');
  L.push('# Utile');
  L.push(pm.x + ' oxlint --init                      # config minimale');
  L.push(pm.x + ' oxlint --print-config              # config effective résolue');
  L.push(pm.x + ' oxlint --rules                     # les ' + OXR.length + ' règles enregistrées');
  L.push(pm.x + ' tsc --showConfig                   # tsconfig résolu');
  L.push(pm.x + ' tsc --help --all                   # toutes les options du compilateur');
  return L.join('\n') + '\n';
}
function warnings() {
  const w = [];
  const rkeys = Array.from(new Set(Object.keys(S.ox.rules).concat(Object.keys(S.ox.ruleOpts), Object.keys(S.ox.rulePos))));
  const missing = new Set();
  rkeys.forEach(k => { const r = OXR.find(x => x.k === k); if (r && !S.ox.plugins.includes(r.p)) missing.add(r.p); });
  if (missing.size) w.push({ msg: 'Des règles réglées appartiennent à des plugins non activés : <code>' + Array.from(missing).join('</code>, <code>') + '</code>. Elles seront ignorées.', fix: ['Activer ces plugins', () => { missing.forEach(p => S.ox.plugins.push(p)); save(); render(); }] });
  const needTa = rkeys.some(k => { const r = OXR.find(x => x.k === k); return r && r.t && S.ox.rules[k] !== 'off'; });
  if (needTa && !(S.pkg.oxTypeAware || S.ox.options.typeAware)) w.push({ msg: 'Des règles <em>type-aware</em> sont activées sans <code>options.typeAware</code> : elles ne s’exécuteront pas.', fix: ['Activer typeAware', () => { S.pkg.oxTypeAware = true; save(); render(); }] });
  if (S.ox.categories.nursery) w.push({ msg: 'La catégorie <code>nursery</code> est activée : ces règles sont instables et peuvent changer sans préavis.' });
  if (!S.ox.plugins.length) w.push({ msg: 'Aucun plugin sélectionné : le champ <code>plugins</code> sera omis et oxlint gardera ses plugins par défaut.' });
  if (S.ts.allowImportingTsExtensions && !(S.ts.noEmit || S.ts.emitDeclarationOnly || S.ts.rewriteRelativeImportExtensions)) w.push({ msg: '<code>allowImportingTsExtensions</code> exige <code>noEmit</code>, <code>emitDeclarationOnly</code> ou <code>rewriteRelativeImportExtensions</code>.' });
  if (S.ts.isolatedDeclarations && !(S.ts.declaration || S.ts.composite)) w.push({ msg: '<code>isolatedDeclarations</code> exige <code>declaration</code> (ou <code>composite</code>).' });
  if (S.ts.composite === true && S.ts.declaration === false) w.push({ msg: '<code>composite</code> implique <code>declaration: true</code> — la valeur <code>false</code> sera refusée.' });
  if (S.ts.noEmit && S.ts.declaration) w.push({ msg: '<code>noEmit</code> avec <code>declaration</code> : aucun <code>.d.ts</code> ne sera écrit.' });
  if (S.ts.verbatimModuleSyntax && S.ts.importsNotUsedAsValues) w.push({ msg: '<code>verbatimModuleSyntax</code> remplace <code>importsNotUsedAsValues</code> — ne garder que le premier.' });
  Object.keys(S.ts).forEach(k => { const o = TSOByName[k]; if (o && o.deprecated) w.push({ msg: '<code>' + k + '</code> est déprécié' + (o.avail === '5' ? ' et supprimé dans TypeScript 7' : '') + '.' }); });
  Object.keys(S.ts).forEach(k => { const o = TSOByName[k]; if (o && !tsVisible(o) && S.tsVer !== 'all') w.push({ msg: '<code>' + k + '</code> n’existe pas dans la version de TypeScript sélectionnée.' }); });
  return w;
}

/* ------------------------------------------------------------- output pane */
const OUTS = [
  { id: 'tsconfig', label: 'tsconfig.json', file: 'tsconfig.json', gen: genTsconfig },
  { id: 'oxlintrc', label: '.oxlintrc.json', file: '.oxlintrc.json', gen: genOxlintrc },
  { id: 'package', label: 'package.json', file: 'package.json', gen: genPackage },
  { id: 'cmd', label: 'commandes', file: 'setup.sh', gen: genCommands }
];
function hl(code, json) {
  let s = esc(code);
  if (!json) return s.replace(/^(#.*)$/gm, '<span class="c">$1</span>');
  s = s.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="c">$1</span>');
  s = s.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)/g, '<span class="k">$1</span>$2');
  s = s.replace(/:(\s*)(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, ':$1<span class="s">$2</span>');
  s = s.replace(/\b(true|false|null)\b/g, '<span class="b">$1</span>');
  s = s.replace(/:(\s*)(-?\d+(?:\.\d+)?)/g, ':$1<span class="n">$2</span>');
  return s;
}
function genOut() {
  const o = OUTS.find(x => x.id === S.out) || OUTS[0];
  const code = o.gen();
  $('#code').innerHTML = hl(code, o.id !== 'cmd');
  const wb = $('#owarn'); wb.innerHTML = '';
  if (S.out === 'tsconfig' || S.out === 'oxlintrc') {
    warnings().slice(0, 6).forEach(w => {
      const d = el('div', { class: 'warnbox' }, '⚠ ' + w.msg);
      if (w.fix) d.appendChild(el('button', { class: 'iconbtn', style: 'margin-left:8px;padding:2px 8px', onclick: w.fix[1] }, w.fix[0]));
      wb.appendChild(d);
    });
  }
  return code;
}
function renderOutTabs() {
  const t = $('#otabs'); t.innerHTML = '';
  OUTS.forEach(o => t.appendChild(el('button', {
    class: 'otab', role: 'tab', 'aria-selected': String(S.out === o.id),
    onclick: () => { S.out = o.id; save(); renderOutTabs(); genOut(); }
  }, esc(o.label))));
}

/* ------------------------------------------------------------------ render */
const TABS = [
  { id: 'tsco', label: 'tsconfig · compilerOptions', count: () => TSO.filter(tsVisible).length, mod: () => Object.keys(S.ts).length, fn: renderTsCompiler },
  { id: 'tsroot', label: 'tsconfig · racine & watch', count: () => TSROOT.length + TSW.length + TSACQ.length, mod: () => Object.keys(S.tsRoot).length + Object.keys(S.tsWatch).length + Object.keys(S.tsAcq).length, fn: renderTsRoot },
  { id: 'oxcfg', label: 'oxlint · config', count: () => OXC.root.length, mod: () => Object.keys(S.ox.categories).length + Object.keys(S.ox.options).length + Object.keys(S.ox.env).length, fn: renderOxConfig },
  { id: 'oxrules', label: 'oxlint · règles', count: () => OXR.length, mod: () => Object.keys(S.ox.rules).length, fn: renderOxRules },
  { id: 'pkg', label: 'projet', count: () => 0, mod: () => 0, fn: renderPkg }
];
function renderTabs() {
  const t = $('#tabs'); t.innerHTML = '';
  TABS.forEach(tb => {
    const m = tb.mod();
    t.appendChild(el('button', {
      class: 'tab', role: 'tab', 'aria-selected': String(S.tab === tb.id),
      onclick: () => {
        S.tab = tb.id; shown = 160;
        S.out = { tsco: 'tsconfig', tsroot: 'tsconfig', oxcfg: 'oxlintrc', oxrules: 'oxlintrc', pkg: 'package' }[tb.id] || S.out;
        save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, esc(tb.label) + (tb.count() ? '<span class="n">' + tb.count() + (m ? ' · ' + m + '✓' : '') + '</span>' : '')));
  });
}
function render() {
  renderTabs();
  const pane = $('#pane'); pane.innerHTML = '';
  (TABS.find(t => t.id === S.tab) || TABS[0]).fn(pane);
  $('#b-ts').textContent = 'tsc ' + (S.tsVer === '5' ? VER.ts5 : VER.ts7) + ' · ' + TSO.length + ' options';
  $('#b-ox').textContent = 'oxlint ' + VER.ox + ' · ' + OXR.length + ' règles';
  const n = Object.keys(S.ts).length + Object.keys(S.tsRoot).length + Object.keys(S.tsWatch).length + Object.keys(S.tsAcq).length
    + Object.keys(S.ox.rules).length + Object.keys(S.ox.categories).length + Object.keys(S.ox.options).length;
  $('#b-cnt').textContent = n + ' réglage' + (n > 1 ? 's' : '');
  renderOutTabs();
  genOut();
  save();
}

/* -------------------------------------------------------------------- init */
$('#q').value = S.q;
$('#qclr').hidden = !S.q;
$('#q').addEventListener('input', e => {
  S.q = e.target.value; shown = 160; $('#qclr').hidden = !S.q;
  clearTimeout(window._qt); window._qt = setTimeout(() => { save(); render(); }, 130);
});
$('#qclr').addEventListener('click', () => { S.q = ''; $('#q').value = ''; $('#qclr').hidden = true; render(); });
$('#copy').addEventListener('click', () => copy(genOut()));
$('#dl').addEventListener('click', () => { const o = OUTS.find(x => x.id === S.out); download(o.file, o.gen()); });
$('#cmts').checked = S.comments;
$('#cmts').addEventListener('change', e => { S.comments = e.target.checked; save(); genOut(); });
$('#reset').addEventListener('click', () => {
  if (!confirm('Tout remettre à zéro ?')) return;
  const theme = document.documentElement.dataset.theme;
  S = fresh(); shown = 160;
  try { localStorage.removeItem(SKEY); } catch (e) {}
  if (theme) document.documentElement.dataset.theme = theme;
  $('#q').value = ''; $('#qclr').hidden = true; $('#cmts').checked = false;
  render(); flash('Réinitialisé');
});
(function themeInit() {
  let th = null;
  try { th = localStorage.getItem(SKEY + '/theme'); } catch (e) {}
  if (th) document.documentElement.dataset.theme = th;
  $('#theme').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(SKEY + '/theme', next); } catch (e) {}
  });
})();
$('#fab').addEventListener('click', () => { document.querySelector('.out').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
document.addEventListener('keydown', e => {
  if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && document.activeElement !== $('#q')) { e.preventDefault(); $('#q').focus(); $('#q').select(); }
  if (e.key === 'Escape' && document.activeElement === $('#q')) $('#q').blur();
});
$('#foot').innerHTML = 'Données extraites de <code>tsc --help --all</code> (' + VER.ts7 + ' et ' + VER.ts5 + '), du schéma JSON SchemaStore de tsconfig, '
  + 'de <code>oxlint --rules</code> et de la documentation officielle oxlint (' + VER.ox + '). '
  + TSO.length + ' options du compilateur, ' + TSW.length + ' watchOptions, ' + OXR.length + ' règles oxlint dont '
  + OXR.filter(r => (r.op && r.op.length) || (r.ap && r.ap.length)).length + ' configurables ('
  + OXR.reduce((a, r) => a + (r.op ? r.op.length : 0) + (r.ap ? r.ap.length : 0), 0) + ' options de règles). '
  + 'Tout est stocké dans ce navigateur, rien n’est envoyé. <kbd>/</kbd> pour rechercher.';
render();
