"""Write a Vercel MCP direct-files deployment payload to stdout.

Run only after npm run build and the final browser verification gate.
The payload uses the already-built directory and does not need npm on Vercel.
"""
from pathlib import Path
import base64
import json
root = Path(__file__).resolve().parents[1] / 'dist'
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
config = {'framework': None, 'headers': [
    {'source': '/sw.js', 'headers': [{'key': 'Cache-Control', 'value': 'no-cache'}]},
    {'source': '/(.*)', 'headers': [{'key': 'X-Content-Type-Options', 'value': 'nosniff'}, {'key': 'Referrer-Policy', 'value': 'strict-origin-when-cross-origin'}]}
]}
files.append({'file': 'vercel.json', 'data': json.dumps(config), 'encoding': 'utf-8'})
print(json.dumps({'target': 'production', 'name': 'zenflow-racer', 'teamId': 'team_s0rU5ad1QWBbDjyDbdixQXRO', 'files': files, 'projectSettings': {'framework': None, 'buildCommand': '', 'installCommand': '', 'outputDirectory': None}}))
