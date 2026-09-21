# Architecture

Brain answers questions about your own notes. It reads everything you have written across your wiki and your projects, including roadmaps and readme files, and keeps a searchable copy. Ask it something in plain English and it finds the passages that actually relate to the question by meaning rather than by matching words, then either hands them back or writes the answer for you.

It is one small program on Cloudflare, locked behind a key, at `brain.heyitsmejosh.com`. There is no website to visit. It exists to be asked things by Claude Code and by other software.

## How it runs

On the Mac, `ingest.mjs` walks the Obsidian wiki and Code directory, chunks all markdown files on paragraph boundaries (capping at 1500 chars), assigns each chunk a content hash as ID, and POSTs them to `/ingest` in batches of 50. The Worker embeds each chunk with Workers AI's embedding model, upserts into Vectorize with the source path as metadata. A client can then call `/api/search` (returns passages) or `/api/ask` (returns an LLM-written answer), or use MCP via `/mcp` (stateless JSON-RPC). All routes require a bearer token.

| File | What it owns |
|---|---|
| `src/index.ts` | HTTP router. Handles `/` (discovery), `/graph` (static graph assets), `/api/search`, `/api/ask`, `/api/ingest`, `/mcp`. Auth gates everything except the graph with a bearer token. Routes to tools.ts for all logic. |
| `src/tools.ts` | Shared tool logic called by both REST and MCP. Two tools: `search_notes` (embeds query, runs Vectorize KNN, returns passages + scores + sources) and `ask_notes` (runs search, concatenates top passages as context, calls Workers AI chat model to synthesize an answer). |
| `src/mcp.ts` | Stateless JSON-RPC dispatcher implementing Model Context Protocol. Handles initialize, ping, tools/list, and tools/call. Returns tool results in MCP format. Same tools as REST; transport never diverges. |
| `src/page.ts` | Static HTML landing page explaining the service. Public by design; holds no note content. |
| `ingest.mjs` | CLI script that walks the Obsidian vault and Code directory, chunks markdown files on blank lines (1500 char max), creates content-hash IDs for deduplication, and POSTs batches of 50 to `/ingest`. Re-runs are idempotent. |
| `test.mjs` | Unit tests for the chunker: boundaries, no empty chunks, idempotent IDs. |
| `wrangler.jsonc` | Cloudflare Worker config. Bindings for AI (embeddings and chat), VEC (Vectorize), TOKEN (bearer auth secret), ASSETS (static graph). |
| `public/graph/` | Pre-rendered memory graph (built by `build.py`). Static HTML, public (no note content). |
