#!/usr/bin/env python3
"""E2E regresyon paketi: her betigi calistirir, expectations.json'a gore gecti/kaldi verir.
Onkosul: `npx electron-vite build` ve localhost:5173'te test uygulamasi (spike/testapps/vite-react19: npx vite).
Kullanim: python3 tests/e2e/suite.py [betik ...]"""
import json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(os.path.dirname(ROOT))
# Test uygulamasi (Vite + React 19): DB_TESTAPP ile degistirilebilir; varsayilan depo disindaki spike klasoru
TESTAPP = os.environ.get('DB_TESTAPP') or os.path.abspath(os.path.join(APP, '..', 'spike', 'testapps', 'vite-react19'))
TMPD = os.environ.get('DB_E2E_TMP') or os.path.join(tempfile.gettempdir(), 'izlix-e2e')
os.makedirs(TMPD, exist_ok=True)

def _subst(x):
    if isinstance(x, str): return x.replace('{TESTAPP}', TESTAPP)
    if isinstance(x, list): return [_subst(i) for i in x]
    if isinstance(x, dict): return {k: _subst(v) for k, v in x.items()}
    return x

EXP = _subst(json.load(open(os.path.join(ROOT, 'expectations.json'))))

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
    out = os.path.join(TMPD, 'suite-%s.json' % name)
    if os.path.exists(out): os.remove(out)
    ud = tempfile.mkdtemp(prefix='ud.', dir=TMPD)
    env = {k: v for k, v in os.environ.items() if k != 'ELECTRON_RUN_AS_NODE'}
    env.update(DB_USER_DATA=ud, DB_SCRIPT=os.path.join(ROOT, name + '.cjs'), DB_DUMP=out, DB_URL='', DB_TESTAPP=TESTAPP)
    if name == 'sync': env['DB_ICLOUD_DIR'] = ud + '/icloud/Izlix'
    if name == 'threat':
        open(ud + '/threat.txt', 'w').write('# test\n127.0.0.1\tmalware-test.invalid\n')
        env['DB_THREAT_LIST'] = ud + '/threat.txt'
    if name == 'ext': env['DB_EXT_DIR'] = '/tmp/ext-try'
    if name in ('onboarding', 'docshots'): env['DB_ONBOARD'] = '1'
    if name == 'docshots': env['DB_SHOT_DIR'] = os.path.join(APP, 'docs', 'screenshots')
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
