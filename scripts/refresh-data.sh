#!/usr/bin/env bash
# Regenerate data/*.json from the real tools, then rebuild index.html.
#
#   ./scripts/refresh-data.sh          # latest typescript 7.x, 5.x and oxlint
#   TS7=7.1.0 OX=1.90.0 ./scripts/refresh-data.sh
#
# Sources of truth, in order of authority:
#   * `tsc --help --all`            -> option names, categories, types, defaults
#   * TypeScript 5's `ts.optionDeclarations` / `ts.optionsForWatch` -> enums, watchOptions
#   * SchemaStore tsconfig schema   -> long prose descriptions
#   * `oxlint --rules -f json`      -> the full rule list with category/fix/default
#   * oxc-project.github.io         -> per-rule docs and rule option schemas
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${WORK:-$(mktemp -d)}"
TS7="${TS7:-7}"
TS5="${TS5:-5}"
OX="${OX:-latest}"
echo "work dir: $WORK"

mkdir -p "$WORK/ts7" "$WORK/ts5"
( cd "$WORK/ts7" && npm init -y >/dev/null && npm i --silent "typescript@$TS7" "oxlint@$OX" )
( cd "$WORK/ts5" && npm init -y >/dev/null && npm i --silent "typescript@$TS5" )

"$WORK/ts7/node_modules/.bin/tsc"  --help --all > "$WORK/tsc-help.txt"
"$WORK/ts5/node_modules/.bin/tsc"  --help --all > "$WORK/tsc5-help.txt"
"$WORK/ts7/node_modules/.bin/oxlint" --rules -f json > "$WORK/oxlint-rules.json"

TS7_VERSION="$(node -p "require('$WORK/ts7/node_modules/typescript/package.json').version")"
TS5_VERSION="$(node -p "require('$WORK/ts5/node_modules/typescript/package.json').version")"
OX_VERSION="$(node -p "require('$WORK/ts7/node_modules/oxlint/package.json').version")"
echo "typescript $TS7_VERSION / $TS5_VERSION, oxlint $OX_VERSION"

node -e "
const ts = require('$WORK/ts5/node_modules/typescript');
const m = t => (t && t.constructor === Map) ? Object.fromEntries(t) : t;
const ser = o => ({
  name: o.name, shortName: o.shortName, type: m(o.type),
  category: o.category && o.category.message,
  description: o.description && o.description.message,
  defaultValueDescription: (o.defaultValueDescription && typeof o.defaultValueDescription === 'object')
    ? o.defaultValueDescription.message : o.defaultValueDescription,
  element: o.element ? { type: m(o.element.type) } : undefined,
});
const fs = require('fs');
fs.writeFileSync('$WORK/ts5-options.json', JSON.stringify(ts.optionDeclarations.map(ser)));
fs.writeFileSync('$WORK/ts5-watch.json', JSON.stringify((ts.optionsForWatch || []).map(ser)));
"

curl -sSL -o "$WORK/tsconfig.schema.json" https://json.schemastore.org/tsconfig.json
curl -sSL -o "$ROOT/data/ox-config.json.tmp" \
  https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json
mv "$ROOT/data/ox-config.json.tmp" "$WORK/oxlint.schema.json"

if [ ! -d "$WORK/oxdocs" ]; then
  git clone --depth 1 https://github.com/oxc-project/oxc-project.github.io.git "$WORK/oxdocs"
fi

cd "$ROOT"
TSIN="$WORK" TSOUT=data/ts-data.json TS7_VERSION="$TS7_VERSION" TS5_VERSION="$TS5_VERSION" \
  python3 scripts/extract-typescript.py
OXRULES="$WORK/oxlint-rules.json" OXDOCS="$WORK/oxdocs" python3 scripts/extract-oxlint-rules.py
OXSCHEMA="$WORK/oxlint.schema.json" python3 scripts/extract-oxlint-config.py

# keep the version shown in the UI in step with what we just read
python3 - "$OX_VERSION" <<'PY'
import re, sys
p = 'src/app.js'
s = open(p).read()
s = re.sub(r"ox: '[^']*' \};", "ox: '%s' };" % sys.argv[1], s, count=1)
open(p, 'w').write(s)
PY

python3 src/build.py
