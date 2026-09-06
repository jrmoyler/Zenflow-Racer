"""Write a Vercel MCP direct-files deployment payload to stdout.

Run only after npm run build and the final browser verification gate.
The payload uses the already-built directory and does not need npm on Vercel.
"""
from pathlib import Path
import argparse
import base64
import json
parser = argparse.ArgumentParser()
parser.add_argument('--target', choices=['preview', 'production'], default='preview')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[1]
root = repo / 'dist'
if not (root / 'index.html').is_file():
    raise SystemExit('Run npm run verify before generating a deployment payload.')
files = []
for path in sorted(root.rglob('*')):
    if not path.is_file():
        continue
    data = path.read_bytes()
    try:
        contents = data.decode('utf-8')
        encoding = 'utf-8'
    except UnicodeDecodeError:
        contents = base64.b64encode(data).decode('ascii')
        encoding = 'base64'
    files.append({'file': path.relative_to(root).as_posix(), 'data': contents, 'encoding': encoding})
# Prebuilt static deployment. Keep the useful production headers.
config = {'framework': None, 'headers': json.loads((repo / 'vercel.json').read_text())['headers']}
files.append({'file': 'vercel.json', 'data': json.dumps(config), 'encoding': 'utf-8'})
print(json.dumps({'target': args.target, 'name': 'zenflow-racer', 'teamId': 'team_s0rU5ad1QWBbDjyDbdixQXRO', 'files': files, 'projectSettings': {'framework': None, 'buildCommand': '', 'installCommand': '', 'outputDirectory': None}}))
