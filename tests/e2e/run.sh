#!/bin/zsh
# kullanim: tests/e2e/run.sh <script.cjs> [url]
OUT=/private/tmp/e2e-tmp/db-result.json; rm -f $OUT
UD=$(mktemp -d /private/tmp/e2e-tmp/ud.XXXX)
env -u ELECTRON_RUN_AS_NODE DB_USER_DATA=$UD DB_ROOT="$PWD" DB_URL="$2" DB_SCRIPT="$PWD/$1" DB_DUMP=$OUT perl -e 'alarm 120; exec @ARGV' npx electron . >/private/tmp/e2e-tmp/db-run.log 2>&1
python3 -c "import json;print(json.dumps(json.load(open('$OUT'))['result'],indent=1,ensure_ascii=False))"
