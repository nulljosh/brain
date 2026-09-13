# brain Technical Whitepaper

**v1.0.0** | September 2026

Notes scattered across dozens of repos are only useful if you can ask them a
question instead of grepping for it. brain is retrieval-augmented generation
over my own notes, built so a question like "what's blocking Epiphany" gets
answered from the actual roadmap files instead of relying on memory. A
Cloudflare Worker indexes the Obsidian wiki and every `roadmap.md`,
`CLAUDE.md` and `README.md` under `~/Documents/Code` into Vectorize, then
answers questions with Workers AI. No model is trained or fine-tuned, because
fine-tuning bakes in a snapshot and these notes change daily; the notes stay
the source of truth and the model only reads them fresh each time. Live,
bearer-gated on every route, at
[brain.heyitsmejosh.com](https://brain.heyitsmejosh.com). There is no UI,
because the only consumers are Claude Code sessions and API calls, not a
person clicking around.

## Ingest

`ingest.mjs` runs on the Mac. It walks the sources, splits each file into
1500-character chunks, and POSTs them to `/api/ingest` in batches of 50. Each
chunk id is a content hash, so re-running after edits only re-embeds what
changed and never duplicates, which matters because notes get re-ingested
often and re-embedding everything every time would be slow and wasteful. The
Worker embeds each chunk with Workers AI and upserts into Vectorize with the
source path as metadata, so an answer can always be traced back to the file
it came from.

## Retrieval

`src/tools.ts` is the only file that knows how retrieval works. Two tools:

- **`search_notes(q, limit)`** embeds the query, does a nearest-neighbour
  lookup, and returns the matching passages verbatim with sources.
- **`ask_notes(q)`** runs the same search, then hands the passages to a
  Workers AI text model with instructions to answer only from them and cite.

REST (`src/index.ts`) and MCP (`src/mcp.ts`, stateless JSON-RPC) both call
the same two functions, so the transports cannot drift apart. MCP exists
because Claude Code sessions can then query brain like any other tool,
without a separate client for REST versus a chat session.

## Endpoints

| Route | Purpose |
|---|---|
| `GET /api/search?q=&limit=` | passages with sources |
| `GET /api/ask?q=` | written answer with sources |
| `POST /api/ingest` | re-index `{ chunks: [{ id, text, source }] }` |
| `POST /mcp` | Model Context Protocol, same two tools |

## Security

These are private notes, project state and personal detail that shouldn't be
world-readable just because the Worker is public. Every route requires
`authorization: Bearer $BRAIN_TOKEN`, including MCP, with no exception for
convenience. The token lives in `.env.local` locally and as a Worker secret
in production. Registered as a user-scope MCP server in Claude Code so any
session can query it without re-authenticating each time.

## Tests

`node test.mjs` checks the chunker: boundaries, idempotent ids, no empty
chunks.

## License

MIT 2026, Joshua Trommel
