# brain

RAG over my own notes. A Cloudflare Worker with a bearer-gated `/api` and `/mcp`, no UI. Live at brain.heyitsmejosh.com and registered as a user-scope MCP server in Claude Code.

- `src/index.ts` routes and auth gate, `src/tools.ts` search and ask, `src/mcp.ts` tool schema, `src/page.ts` the one static page
- Vectorize holds note chunks, Workers AI does embeddings and the answer. No model is trained; the notes stay the truth
- Deploy: `env -u CLOUDFLARE_API_TOKEN npx wrangler deploy`. Tests: `node --test test.mjs`
- The bearer token is a Worker secret. Never commit it
