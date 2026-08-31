# brain

RAG over my own notes. Cloudflare Worker + Vectorize + Workers AI. No model training.

- `src/index.ts` — POST `/ingest` (embed + upsert), POST `/ask` (embed question, top-6, stuff into system prompt, answer). Bearer `TOKEN` secret.
- `ingest.mjs` — walks the Obsidian wiki + every `roadmap.md`/`CLAUDE.md`/`README.md` under `~/Documents/Code`, chunks to 1500 chars, POSTs in batches of 50. Chunk ids are content hashes, so re-running is idempotent.
- `test.mjs` — chunker self-check. `node test.mjs`

## Use
```bash
source .env.local
node ingest.mjs                     # re-index after notes change
curl -s -X POST https://brain.trommatic.workers.dev/ask \
  -H "authorization: Bearer $BRAIN_TOKEN" -H 'content-type: application/json' \
  -d '{"question":"what is blocked on me?"}'
```
