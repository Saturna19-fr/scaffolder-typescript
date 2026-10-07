import json, re, os

rules = json.load(open(os.environ.get('OXRULES', 'oxlint-rules.json')))
base = os.environ.get('OXDOCS', 'docsrepo') + '/src/docs/guide/usage/linter/rules'

def strip_md(s, limit=None, keep_code=False):
    if not keep_code:
        s = re.sub(r'```.*?```', '', s, flags=re.S)
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'<script setup>.*?</script>', '', s, flags=re.S)
    s = re.sub(r'<Rule[A-Za-z]*\s*/>', '', s)
    s = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', s)
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\n{3,}', '\n\n', s).strip()
    if limit and len(s) > limit:
        s = s[:limit].rsplit(' ', 1)[0] + '…'
    return s

def section(body, title):
    """Capture a heading's content, stopping at a heading of same or higher level."""
    m = re.search(r'^(#{2,4})\s+' + re.escape(title) + r'\s*$', body, flags=re.M)
    if not m: return ''
    lvl = len(m.group(1))
    rest = body[m.end():]
    stop = re.search(r'^#{1,%d}\s' % lvl, rest, flags=re.M)
    return rest[:stop.start()] if stop else rest

def parse_type(ts):
    ts = (ts or '').strip().strip('`').strip()
    enum = None
    if '"' in ts and re.fullmatch(r'\s*"[^"]*"(\s*\|\s*"[^"]*")*\s*', ts):
        return ('enum', re.findall(r'"([^"]*)"', ts), ts)
    if '|' in ts and '"' in ts:
        return ('enum', re.findall(r'"([^"]*)"', ts), ts)
    low = ts.lower()
    if low in ('boolean','bool'): return ('boolean', None, ts)
    if low in ('string',): return ('string', None, ts)
    if low in ('number','integer','usize','u32','f64','int'): return ('number', None, ts)
    if low.endswith('[]') or low.startswith('array') or low.startswith('vec'): return ('list', None, ts)
    if low in ('object','map'): return ('object', None, ts)
    return ('raw', None, ts)

POS_RE = re.compile(r'^The (\d+)(?:st|nd|rd|th) option$', re.I)
IDX_RE = re.compile(r'^\[(\d+)\]$')
VAL_RE = re.compile(r'^"(.*)"$')

def _slot(name, body):
    # `type:` / `default:` belong to this heading only; anything under a nested
    # #### sub-heading documents a sub-property or an allowed value instead.
    cut = re.search(r'^####\s', body, flags=re.M)
    head = body[:cut.start()] if cut else body
    tm = re.search(r'^type:\s*(.+?)\s*$', head, flags=re.M)
    dm = re.search(r'^default:\s*(.+?)\s*$', head, flags=re.M)
    rest = re.sub(r'^type:\s*.+?$', '', body, flags=re.M)
    rest = re.sub(r'^default:\s*.+?$', '', rest, flags=re.M)
    t, enum, traw = parse_type(tm.group(1) if tm else None)
    # "This option is an object with the following properties" and friends:
    # the sub-properties live at #### level, so expose the slot as raw JSON.
    if not tm and re.search(r'object with the following propert', head, re.I):
        t, enum, traw = 'raw', None, 'object'
    return dict(name=name, type=t, enum=enum, typeRaw=traw,
                default=(dm.group(1).strip().strip('`') if dm else None),
                doc=strip_md(rest, 700, keep_code=True))

def parse_options(sec):
    """Split a Configuration/Options section into named props and positional slots.

    Three documented shapes:
      * `### someProp`            -> named property of the options object
      * `### The 1st option`/`[0]`-> positional argument after the severity
      * `### "always"` ...        -> the allowed values of a single positional string
    """
    parts = re.split(r'^###\s+(?!#)(.+?)\s*$', sec, flags=re.M)
    intro = strip_md(parts[0], 400)
    heads = [(parts[i].strip().strip('`'), parts[i + 1]) for i in range(1, len(parts), 2)]
    if heads and all(VAL_RE.match(h) for h, _ in heads):
        vals = [VAL_RE.match(h).group(1) for h, _ in heads]
        doc = '\n'.join('"%s" — %s' % (VAL_RE.match(h).group(1), strip_md(b, 220)) for h, b in heads)
        return intro, [], [dict(name='option 1', type='enum', enum=vals, typeRaw=' | '.join('"%s"' % v for v in vals),
                                default=None, doc=doc, i=0)]
    props, pos = [], {}
    for h, body in heads:
        m = POS_RE.match(h) or IDX_RE.match(h)
        if m:
            i = int(m.group(1)) - (1 if POS_RE.match(h) else 0)
            sl = _slot('option %d' % (i + 1), body); sl['i'] = i
            pos[i] = sl
        else:
            props.append(_slot(h, body))
    return intro, props, [pos[i] for i in sorted(pos)]

out = []
for r in rules:
    scope, name = r['scope'], r['value']
    p = os.path.join(base, scope, name + '.md')
    raw = open(p, encoding='utf-8').read()
    fm = re.match(r'^---\n(.*?)\n---\n', raw, flags=re.S)
    body = raw[fm.end():] if fm else raw
    upstream = None; version = None; fullkey = None
    if fm:
        um = re.search(r'^upstream:\s*"(.*?)"', fm.group(1), flags=re.M)
        if um: upstream = um.group(1)
        vm = re.search(r'^version:\s*"(.*?)"', fm.group(1), flags=re.M)
        if vm: version = vm.group(1)
        rm = re.search(r'^rule:\s*"(.*?)"', fm.group(1), flags=re.M)
        if rm: fullkey = rm.group(1)
    what = strip_md(section(body, 'What it does'), 700)
    why = strip_md(section(body, 'Why is this bad?'), 700)
    sec = section(body, 'Configuration') or section(body, 'Options')
    intro, props, pos = parse_options(sec) if sec else ('', [], [])
    full = fullkey or (scope + '/' + name)
    key = name if full.startswith('eslint/') else full
    out.append(dict(s=scope, n=name, k=key, p=full.split('/')[0], c=r['category'], d=r['default'], f=r['fix'],
                    t=r['type_aware'], u=r['docs_url'], up=upstream, v=version,
                    w=what, y=why, oi=intro, op=props, ap=pos))

json.dump(out, open('data/ox-rules.json','w'), ensure_ascii=False, separators=(',',':'))
print('rules', len(out), 'bytes', os.path.getsize('data/ox-rules.json'))
print('with named options', sum(1 for x in out if x['op']), 'props', sum(len(x['op']) for x in out))
print('with positional options', sum(1 for x in out if x['ap']), 'slots', sum(len(x['ap']) for x in out))
from collections import Counter
print(Counter(p['type'] for x in out for p in x['op']))
nu=[x['s']+'/'+x['n'] for x in out if not x['w']]
print('no what', len(nu), nu[:5])
r=[x for x in out if x['n']=='no-unused-vars' and x['s']=='eslint'][0]
print(json.dumps(r, ensure_ascii=False)[:1200])
