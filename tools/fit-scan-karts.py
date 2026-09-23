#!/usr/bin/env python3
"""Fit every downloaded scan in RAW_DIR (named <tier>-<id>.glb) into assets/models/tiers/."""
import json, os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
raw, out = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, '..', 'assets', 'models', 'tiers')
only = set(sys.argv[3:])
cfg = json.load(open(os.path.join(here, 'scan-karts.json')))
os.makedirs(out, exist_ok=True)
report = {}
for name in sorted(os.listdir(raw)):
    if not name.endswith('.glb') or '-' not in name: continue
    tier, id_ = name[:-4].split('-', 1)
    if id_ not in cfg['accent'] or (only and f'{tier}-{id_}' not in only and id_ not in only): continue
    o = cfg['overrides'].get(f'{tier}-{id_}', {})
    cmd = [sys.executable, os.path.join(here, 'fit-scan-kart.py'), os.path.join(raw, name), os.path.join(out, f'{id_}-{tier}.glb'), '--id', id_, '--tier', tier, '--accent', cfg['accent'][id_]]
    if 'front' in o: cmd += ['--front', o['front']]
    if o.get('flip'): cmd += ['--flip']
    if o.get('noWheels'): cmd += ['--no-wheels']
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(name, 'FAILED', r.stderr[-800:]); continue
    info = json.loads(r.stdout.strip().splitlines()[-1]); report[f'{id_}-{tier}'] = info
    print(f"{id_:10s} {tier:5s} orient={info['orient']} size={info['size']} wheels={[ (w['r'],w['width']) for w in info['wheels']]}")
if not only:  # a partial refit must not truncate the full report
    json.dump(report, open(os.path.join(here, '..', 'docs', 'chassis-tiers', 'fit-report.json'), 'w'), indent=1)
