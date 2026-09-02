# brain

![version](https://img.shields.io/badge/version-v1.0.0-blue) ![license](https://img.shields.io/badge/license-MIT-green) [![GitHub](https://img.shields.io/badge/GitHub-nulljosh%2Fbrain-black?logo=github)](https://github.com/nulljosh/brain)
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
