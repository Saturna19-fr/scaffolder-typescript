import json, re
import os
d = json.load(open(os.environ.get('OXSCHEMA', 'oxlint.schema.json'))); defs = d['definitions']

def clean(s):
    s = re.sub(r'```json(.*?)```', '', s, flags=re.S)
    s = re.sub(r'```.*?```', '', s, flags=re.S)
    return re.sub(r'\n{2,}', '\n', s).strip()

def resolve(sch, depth=0):
    """Return (type, enum, default, desc) for a property schema."""
    if not isinstance(sch, dict): return ('raw', None, None, '')
    desc = clean(sch.get('markdownDescription') or sch.get('description') or '')
    dflt = sch.get('default')
    t = sch.get('type'); enum = sch.get('enum')
    for key in ('allOf','anyOf','oneOf'):
        if key in sch and depth < 4:
            for br in sch[key]:
                if '$ref' in br:
                    tgt = defs.get(br['$ref'].split('/')[-1], {})
                    t2, e2, d2, desc2 = resolve(tgt, depth+1)
                    t = t or t2; enum = enum or e2
                    if dflt is None: dflt = d2
                    desc = desc or desc2
                elif isinstance(br, dict):
                    if br.get('enum'): enum = enum or br['enum']
                    if br.get('type') and br['type'] != 'null': t = t or br['type']
    if '$ref' in sch and depth < 4:
        tgt = defs.get(sch['$ref'].split('/')[-1], {})
        t2, e2, d2, desc2 = resolve(tgt, depth+1)
        t = t or t2; enum = enum or e2
        if dflt is None: dflt = d2
        desc = desc or desc2
    if isinstance(t, list): t = next((x for x in t if x != 'null'), 'string')
    if enum: t = 'enum'
    elif t == 'array': t = 'list'
    elif t == 'integer': t = 'number'
    elif t not in ('boolean','string','number','object','list','enum'): t = 'raw'
    return (t, enum, dflt, desc)

def props_of(defname):
    sch = defs[defname]
    p = sch.get('properties') or {}
    out = []
    for k, v in p.items():
        t, e, df, ds = resolve(v)
        out.append(dict(name=k, type=t, enum=e, default=df, doc=ds))
    return out

cfg = {}
cfg['options'] = props_of('OxlintOptions')
cfg['plugins'] = defs['LintPluginOptionsSchema']['enum']
cfg['categories'] = list(defs['OxlintCategories']['properties'].keys())
cfg['severities'] = defs['AllowWarnDeny']['enum'] if 'enum' in defs.get('AllowWarnDeny',{}) else ['allow','off','warn','error','deny']

# env list from OxlintEnv description bullets
envdesc = defs['OxlintEnv'].get('description','')
envs = re.findall(r'^- (\S+) - (.*)$', envdesc, flags=re.M)
cfg['envs'] = [dict(name=a, doc=b) for a, b in envs]
cfg['envDoc'] = clean(envdesc.split('Available environments:')[0])

# settings
S = defs['OxlintSettings']['properties']
mapping = {'jest':'JestPluginSettings','jsdoc':'JSDocPluginSettings','jsx-a11y':'JSXA11yPluginSettings',
           'next':'NextPluginSettings','react':'ReactPluginSettings','vitest':'VitestPluginSettings'}
cfg['settings'] = [dict(plugin=k, props=props_of(v), default=S[k].get('default')) for k, v in mapping.items()]

# root-level fields
cfg['root'] = []
for k, v in d['properties'].items():
    if k == '$schema': continue
    t, e, df, ds = resolve(v)
    cfg['root'].append(dict(name=k, type=t, default=df, doc=ds))

cfg['globalsDoc'] = clean((d['properties']['globals'].get('markdownDescription') or ''))
json.dump(cfg, open(os.environ.get('OXCFGOUT', 'data/ox-config.json'), 'w'), ensure_ascii=False)
print('options', len(cfg['options']), [o['name'] for o in cfg['options']])
print('plugins', cfg['plugins'])
print('severities', cfg['severities'])
print('envs', len(cfg['envs']), [e['name'] for e in cfg['envs']])
print('settings', [(s['plugin'], [p['name'] for p in s['props']]) for s in cfg['settings']])
print('root', [(r['name'], r['type']) for r in cfg['root']])
