import json, re, os

# ---------- 1. parse tsc 7 --help --all ----------
def parse_help(path):
    txt = open(path, encoding='utf-8').read()
    cat = None
    out = {}
    blocks = re.split(r'\n\n+', txt)
    for b in blocks:
        b = b.strip('\n')
        if not b: continue
        if b.startswith('###'):
            cat = b.replace('###','').strip(); continue
        m = re.match(r'^([A-Z][A-Z ]{3,})$', b.split('\n')[0].strip())
        if m and not b.split('\n')[0].startswith('--'):
            cat = m.group(1).strip()
            if len(b.split('\n')) == 1: continue
        lines = b.split('\n')
        # A block with no description is split from its own `type:` / `default:` lines
        # by the blank line in between, so re-attach those to the previous option.
        if not lines[0].startswith('--'):
            if out and re.match(r'^(type|one of|one or more|default):', lines[0]):
                prev = out[list(out)[-1]]
                for ln in lines:
                    if ln.startswith('type: '): prev['type'] = ln[6:].strip()
                    elif ln.startswith('one of: '): prev['enum'] = [x.strip() for x in ln[8:].split(',')]; prev['type'] = prev['type'] or 'enum'
                    elif ln.startswith('one or more: '): prev['type'] = 'list'
                    elif ln.startswith('default: '): prev['default'] = ln[9:].strip()
            continue
        names = [x.strip() for x in lines[0].split(',')]
        name = names[0].lstrip('-')
        aliases = [x.lstrip('-') for x in names[1:]]
        desc, typ, default, enum = [], None, None, None
        for ln in lines[1:]:
            if ln.startswith('type: '): typ = ln[6:].strip()
            elif ln.startswith('one of: '): enum = [x.strip() for x in ln[8:].split(',')]; typ = typ or 'enum'
            elif ln.startswith('one or more: '):
                v = ln[13:].strip()
                typ = 'list'
                if v != 'string': enum = [x.strip() for x in v.split(',')]
            elif ln.startswith('default: '): default = ln[9:].strip()
            else: desc.append(ln.strip())
        if name in out and not desc: continue
        out[name] = dict(name=name, aliases=aliases, category=cat,
                         description=' '.join(desc), type=typ, default=default, enum=enum)
    return out

IN  = os.environ.get('TSIN', '.')
OUT = os.environ.get('TSOUT', 'data/ts-data.json')
TS7_VERSION = os.environ.get('TS7_VERSION', '7.0.2')
TS5_VERSION = os.environ.get('TS5_VERSION', '5.9.3')
_p = lambda f: os.path.join(IN, f)

ts7 = parse_help(_p('tsc-help.txt'))
ts5h = parse_help(_p('tsc5-help.txt'))
ts5 = {o['name']: o for o in json.load(open(_p('ts5-options.json')))}
watch5 = {o['name']: o for o in json.load(open(_p('ts5-watch.json')))}

schema = json.load(open(_p('tsconfig.schema.json')))
defs = schema['definitions']
sprops = defs['compilerOptionsDefinition']['properties']['compilerOptions']['anyOf'][0]['properties']
wprops = defs['watchOptionsDefinition']['properties']['watchOptions']['anyOf'][0].get('properties', {}) if 'anyOf' in defs['watchOptionsDefinition']['properties']['watchOptions'] else defs['watchOptionsDefinition']['properties']['watchOptions'].get('properties', {})

# Sections of `tsc --help --all` that are not `compilerOptions`:
NON_COMPILER_CATS = {'Command-line Options', 'ALL COMPILER OPTIONS', 'WATCH OPTIONS', 'BUILD OPTIONS'}
WATCH_CAT = 'WATCH OPTIONS'
CLI_ONLY = {n for src in (ts7, ts5h) for n, o in src.items() if o.get('category') in NON_COMPILER_CATS}
WATCH_FROM_HELP = {n: o for src in (ts5h, ts7) for n, o in src.items() if o.get('category') == WATCH_CAT}

def norm_type(o, name):
    t = o.get('type')
    if o.get('enum'): return 'enum'
    if t in ('boolean','string','number','list','object'): return t
    s = sprops.get(name) or {}
    st = s.get('type')
    if isinstance(st, list): st = st[0]
    if st == 'array': return 'list'
    if st in ('boolean','string','number','integer','object'): return 'number' if st=='integer' else st
    return t or 'string'

def sdesc(name, src=None):
    s = (src or sprops).get(name) or {}
    d = s.get('markdownDescription') or s.get('description') or ''
    d = re.sub(r'[ \t]+', ' ', d)
    return re.sub(r'\n{3,}', '\n\n', d).strip()

def senum(name, src=None):
    s = (src or sprops).get(name) or {}
    for key in ('enum',):
        if key in s: return [str(x) for x in s[key] if x is not None]
    if s.get('type')=='array' and isinstance(s.get('items'),dict):
        it = s['items']
        if 'enum' in it: return [str(x) for x in it['enum'] if x is not None]
        if 'anyOf' in it:
            for br in it['anyOf']:
                if 'enum' in br: return [str(x) for x in br['enum'] if x is not None]
    if 'anyOf' in s:
        for br in s['anyOf']:
            if 'enum' in br: return [str(x) for x in br['enum'] if x is not None]
    return None

DEPRECATED = {'charset','keyofStringsOnly','noImplicitUseStrict','noStrictGenericChecks','out',
              'suppressExcessPropertyErrors','suppressImplicitAnyIndexErrors','preserveValueImports',
              'importsNotUsedAsValues','prepend','reactNamespace'}

names = sorted(set(ts7) | set(ts5) | set(ts5h) | set(sprops))
options = []
for n in names:
    if n in CLI_ONLY: continue
    a = ts7.get(n) or {}
    b = ts5h.get(n) or {}
    c = ts5.get(n) or {}
    base = a or b or {'name': n, 'category': None, 'description': '', 'type': None, 'default': None, 'enum': None, 'aliases': []}
    enum = base.get('enum') or (list(c['type'].keys()) if isinstance(c.get('type'), dict) else None) or senum(n)
    if isinstance(c.get('element'),dict) and isinstance(c['element'].get('type'),dict):
        enum = enum or list(c['element']['type'].keys())
    typ = norm_type(dict(type=base.get('type'), enum=enum), n)
    if c.get('type')=='list' or (base.get('type')=='list'): typ='list'
    desc_short = base.get('description') or (c.get('description') or '')
    desc_long = sdesc(n)
    default = base.get('default') or (b.get('default') if b else None)
    if default in (None,'') and c.get('defaultValueDescription') is not None:
        default = str(c['defaultValueDescription'])
    avail = ('7' if n in ts7 else '') + ('5' if (n in ts5h or n in ts5) else '')
    options.append(dict(name=n, aliases=base.get('aliases') or ([c['shortName']] if c.get('shortName') else []),
        category=base.get('category') or c.get('category') or 'Other',
        type=typ, enum=enum, default=(None if default in ('undefined','') else default),
        short=re.sub(r'\s+',' ',desc_short).strip(), long=desc_long,
        avail=avail, deprecated=n in DEPRECATED))

watch = []
WATCH_SKIP = {n for n, v in wprops.items() if (v.get('description') or '').strip() == '~'} - set(watch5) - set(WATCH_FROM_HELP)
for n in sorted((set(watch5) | set(wprops) | set(WATCH_FROM_HELP)) - WATCH_SKIP):
    c = watch5.get(n) or {}
    h = WATCH_FROM_HELP.get(n) or {}
    enum = list(c['type'].keys()) if isinstance(c.get('type'),dict) else (h.get('enum') or senum(n, wprops))
    if isinstance(c.get('element'),dict) and isinstance(c['element'].get('type'),dict):
        enum = enum or list(c['element']['type'].keys())
    t = c.get('type'); t = 'enum' if enum else ('list' if t=='list' else (t if isinstance(t,str) else 'string'))
    s = wprops.get(n) or {}
    if not enum and (s.get('type')=='array'): t='list'
    if not enum and s.get('type')=='boolean': t='boolean'
    if h.get('type') in ('boolean','number','string') and not enum: t = h['type']
    dflt = h.get('default')
    if dflt in (None, '', 'undefined') and c.get('defaultValueDescription') is not None:
        d0 = str(c['defaultValueDescription'])
        # optionDeclarations stores enum defaults as the map index — useless, skip those
        dflt = None if (enum and d0.isdigit()) else d0
    watch.append(dict(name=n, type=t, enum=enum, default=(None if dflt in ('undefined','') else dflt),
                      short=re.sub(r'\s+',' ',(c.get('description') or h.get('description') or '')).strip(), long=sdesc(n,wprops)))

json.dump(dict(options=options, watch=watch, tsVersions=dict(v7=TS7_VERSION, v5=TS5_VERSION)),
          open(OUT, 'w'), ensure_ascii=False)
print('ts options', len(options), 'watch', len(watch))
from collections import Counter
print(Counter(o['category'] for o in options))
print(Counter(o['type'] for o in options))
print('no desc:', [o['name'] for o in options if not o['short'] and not o['long']])

# ---------- post-processing ----------
data = json.load(open(OUT))
opts = {o['name']: o for o in data['options']}

opts['paths']['type'] = 'object'
opts['plugins']['enum'] = None
opts['plugins']['type'] = 'raw'
opts['ignoreDeprecations']['category'] = 'Backwards Compatibility'
for w in data['watch']:
    if w['name'] == 'watchInterval' and not w['short']:
        w['short'] = 'Polling interval in milliseconds, used by the polling watchFile strategies.'
        w['type'] = 'number'

# union enums between TS5 and TS7, marking values only present in one
for n in names:
    if n in opts and opts[n]['enum']:
        e7 = (ts7.get(n) or {}).get('enum') or []
        e5 = (ts5h.get(n) or {}).get('enum') or []
        union, seen = [], set()
        for v in list(e7) + list(e5) + list(opts[n]['enum']):
            for part in str(v).split('/'):
                if part and part not in seen:
                    seen.add(part); union.append(part)
        legacy = set()
        for v in e5:
            for p in str(v).split('/'):
                if p and not any(p in str(x).split('/') for x in e7) and e7:
                    legacy.add(p)
        opts[n]['enum'] = union
        opts[n]['enumLegacy'] = sorted(legacy)

data['options'] = [opts[n] for n in sorted(opts)]

# ---------- root-level tsconfig fields ----------
root = []
for key, defname, typ in [('files','filesDefinition','list'), ('include','includeDefinition','list'),
                          ('exclude','excludeDefinition','list'), ('extends','extendsDefinition','raw'),
                          ('references','referencesDefinition','raw'), ('compileOnSave','compileOnSaveDefinition','boolean')]:
    p = defs[defname]['properties'][key]
    d = p.get('markdownDescription') or p.get('description') or ''
    root.append(dict(name=key, type=typ, long=re.sub(r'\n{3,}','\n\n',re.sub(r'[ \t]+',' ',d)).strip(),
                     default=str(p.get('default')) if 'default' in p else None))
data['root'] = root

ta = defs['typeAcquisitionDefinition']['properties']['typeAcquisition']
tap = (ta.get('properties') or (ta.get('anyOf') or [{}])[0].get('properties') or {})
data['typeAcquisition'] = [dict(name=k, type=('list' if (v.get('type')=='array') else (v.get('type') if isinstance(v.get('type'),str) else 'string')),
                                long=re.sub(r'\n{3,}','\n\n',re.sub(r'[ \t]+',' ',(v.get('markdownDescription') or v.get('description') or ''))).strip(),
                                default=str(v['default']) if 'default' in v else None) for k,v in tap.items()]

json.dump(data, open(OUT, 'w'), ensure_ascii=False)
print('post: options', len(data['options']), 'root', len(data['root']), 'typeAcq', len(data['typeAcquisition']))
print('target enum', opts['target']['enum'], opts['target'].get('enumLegacy'))
print('module enum', opts['module']['enum'], opts['module'].get('enumLegacy'))
print('lib count', len(opts['lib']['enum']))
