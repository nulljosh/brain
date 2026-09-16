#!/usr/bin/env python3
# Rebuilds index.html from ~/.claude memory files. Run after memories change.
# Public deploy (brain.heyitsmejosh.com): sensitive memories are dropped and
# PII patterns scrubbed before anything reaches the generated site.
import os, re, json
MEM = os.path.expanduser('~/.claude/projects/-Users-joshua/memory')

# memories that never ship, matched against slug (hyphen/underscore-insensitive)
BLOCK = re.compile(r'recovery|security[_-]sin|user[_-]phone|kv[_-]admin|account', re.I)
# scrub PII patterns from anything that survives
SCRUB = [
    (re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+'), '[email]'),
    (re.compile(r'\+?1?[\s(]*\d{3}[\s)-]*\d{3}[\s-]*\d{4}'), '[phone]'),
    (re.compile(r'(password|passcode|token|secret|api[_ -]?key)\S*\s*(reset|is|=|:)?\s*\S*', re.I), '[redacted]'),
]
def clean(s):
    for p, r in SCRUB: s = p.sub(r, s)
    return s

def cat(i):
    i = i.replace('-', '_')
    for p in ('feedback', 'project', 'user', 'reference'):
        if i.startswith(p): return p
    return 'project'

nodes, dropped = [], 0
for f in sorted(os.listdir(MEM)):
    if not f.endswith('.md') or f == 'MEMORY.md': continue
    t = open(os.path.join(MEM, f)).read()
    name = re.search(r'^name: (.+)$', t, re.M)
    desc = re.search(r'^description: (.+)$', t, re.M)
    nid = name.group(1) if name else f[:-3]
    if BLOCK.search(nid) or BLOCK.search(f):
        dropped += 1; continue
    nodes.append({'id': nid, 'desc': clean((desc.group(1) if desc else '').strip('"'))[:140],
                  'type': cat(nid), 'links': re.findall(r'\[\[([^\]]+)\]\]', t)})

tpl = open(os.path.join(os.path.dirname(__file__), 'template.html')).read()
out = tpl.replace('__DATA__', json.dumps(nodes))
open(os.path.join(os.path.dirname(__file__), 'index.html'), 'w').write(out)
print(f'{len(nodes)} memories -> index.html ({dropped} redacted)')

# self-check: no PII in output
assert not re.search(r'@(gmail|icloud)|778.?201.?4533|Joshisrad', out), 'PII leaked into index.html'
