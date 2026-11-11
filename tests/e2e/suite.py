#!/usr/bin/env python3
"""E2E regresyon paketi: her betigi calistirir, expectations.json'a gore gecti/kaldi verir.
Onkosul: `npx electron-vite build` ve localhost:5173'te test uygulamasi (spike/testapps/vite-react19: npx vite).
Kullanim: python3 tests/e2e/suite.py [betik ...]"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(os.path.dirname(ROOT))
EXP = json.load(open(os.path.join(ROOT, 'expectations.json')))

def get(obj, path):
    for part in re.findall(r'[^.\[\]]+|\[\d+\]', path):
        if part.startswith('['):
            try: obj = obj[int(part[1:-1])]
            except (IndexError, TypeError, KeyError): return None
        else: obj = obj.get(part) if isinstance(obj, dict) else None
        if obj is None: return None
    return obj

def check(res, path, op, want):
    pre = None
    if ':' in path: pre, path = path.split(':', 1)
    got = get(res, path)
    if pre == 'max': got = max(got)
    if pre == 'min': got = min(got)
    if want == '@base': want = res.get('base')
    try:
        ok = {'eq': lambda: got == want, 'lt': lambda: got < want, 'gt': lambda: got > want, 'gte': lambda: got >= want,
              'contains': lambda: want in got, 'len': lambda: len(got) == want, 'alleq': lambda: all(x == want for x in got)}[op]()
    except Exception:
        ok = False
    return ok, got

def run(name):
    out = '/private/tmp/e2e-tmp/suite-%s.json' % name
    if os.path.exists(out): os.remove(out)
    ud = subprocess.check_output(['mktemp', '-d', '/private/tmp/e2e-tmp/ud.XXXX']).decode().strip()
    env = {k: v for k, v in os.environ.items() if k != 'ELECTRON_RUN_AS_NODE'}
    env.update(DB_USER_DATA=ud, DB_SCRIPT=os.path.join(ROOT, name + '.cjs'), DB_DUMP=out, DB_URL='')
    if name == 'ext': env['DB_EXT_DIR'] = '/tmp/ext-try'
    if name == 'onboarding': env['DB_ONBOARD'] = '1'
    subprocess.run(['perl', '-e', 'alarm 150; exec @ARGV', 'npx', 'electron', '.'], cwd=APP, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not os.path.exists(out): return None
    return json.load(open(out))['result']

names = sys.argv[1:] or list(EXP)
failed = 0
for name in names:
    res = run(name)
    if res is None or (isinstance(res, dict) and ('scriptError' in res or 'fail' in res)):
        print('FAIL  %-20s betik calismadi: %s' % (name, str(res)[:160])); failed += 1; continue
    bad = []
    for path, op, want in EXP[name]:
        ok, got = check(res, path, op, want)
        if not ok: bad.append('%s %s %r (gercek: %r)' % (path, op, want, got))
    if bad:
        failed += 1; print('FAIL  %-20s' % name); [print('        - ' + b) for b in bad]
    else:
        print('ok    %-20s (%d kontrol)' % (name, len(EXP[name])))
print('\n%d/%d betik gecti' % (len(names) - failed, len(names)))
sys.exit(1 if failed else 0)
