# brain

![version](https://img.shields.io/badge/version-v1.0.0-blue) ![license](https://img.shields.io/badge/license-MIT-green) [![GitHub](https://img.shields.io/badge/GitHub-nulljosh%2Fbrain-black?logo=github)](https://github.com/nulljosh/brain)


RAG over my own notes. Cloudflare Worker + Vectorize + Workers AI. No model training.

Live: **https://brain.heyitsmejosh.com** (bearer-gated, every route — these are private notes)

## Layout
- `src/tools.ts` — `search_notes`, `ask_notes`, `ingest`. The only file that knows how retrieval works; REST and MCP both call it, so they can't drift.
- `src/mcp.ts` — stateless JSON-RPC MCP transport.
- `src/index.ts` — router + auth.
- `ingest.mjs` — walks the Obsidian wiki + every `roadmap.md`/`CLAUDE.md`/`README.md` under `~/Documents/Code`, chunks to 1500 chars, POSTs in batches of 50. Chunk ids are content hashes, so re-running is idempotent.
- `test.mjs` — chunker self-check. `node test.mjs`

## Endpoints
| | |
|---|---|
| `GET /api/search?q=&limit=` | matching passages verbatim, with sources |
| `GET /api/ask?q=` | a written answer with sources (slower, a model writes it) |
| `POST /api/ingest` | re-index; body `{ chunks: [{ id, text, source }] }` |
| `POST /mcp` | Model Context Protocol, same two tools |

## Use
```bash
# set -a, not plain source: ingest.mjs reads BRAIN_TOKEN from the environment, and a
# bare `source` leaves it unexported, so node gets nothing and every batch 401s.
set -a && source .env.local && set +a
node ingest.mjs                                    # re-index after notes change
curl -s -H "authorization: Bearer $BRAIN_TOKEN" \
  "https://brain.heyitsmejosh.com/api/search?q=what+is+blocked+on+me"
```

## As an MCP server
```bash
claude mcp add --transport http brain https://brain.heyitsmejosh.com/mcp \
  --header "authorization: Bearer $BRAIN_TOKEN"
```
