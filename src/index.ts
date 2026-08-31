const EMBED = "@cf/baai/bge-base-en-v1.5";
const CHAT = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SYSTEM = `You are Joshua's second brain. You know his projects, roadmaps and notes.
Answer only from the CONTEXT below. If it isn't there, say you don't know.
Be terse: lead with the answer in 1-3 lines. No preamble, no bullet walls.

CONTEXT:
`;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await handle(req, env);
    } catch (e: any) {
      return Response.json({ error: String(e?.stack ?? e) }, { status: 500 });
    }
  },
};

async function handle(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method !== "POST") return new Response("POST /ingest or /ask", { status: 405 });

    const auth = req.headers.get("authorization");
    if (!env.TOKEN || auth !== `Bearer ${env.TOKEN}`) return new Response("unauthorized", { status: 401 });

    const body = (await req.json()) as { chunks?: Chunk[]; question?: string };

    if (url.pathname === "/ingest") {
      const chunks = body.chunks ?? [];
      if (!chunks.length) return Response.json({ error: "no chunks" }, { status: 400 });
      const { data } = await env.AI.run(EMBED, { text: chunks.map((c) => c.text) });
      await env.VEC.upsert(
        data.map((values: number[], i: number) => ({
          id: chunks[i].id,
          values,
          metadata: { text: chunks[i].text.slice(0, 9000), source: chunks[i].source },
        })),
      );
      return Response.json({ ok: true, count: data.length });
    }

    if (url.pathname === "/ask") {
      const q = body.question?.trim();
      if (!q) return Response.json({ error: "no question" }, { status: 400 });
      const { data } = await env.AI.run(EMBED, { text: [q] });
      const hits = await env.VEC.query(data[0], { topK: 6, returnMetadata: true });
      const context = hits.matches
        .map((m: any) => `# ${m.metadata.source}\n${m.metadata.text}`)
        .join("\n\n---\n\n");
      const res = await env.AI.run(CHAT, {
        messages: [
          { role: "system", content: SYSTEM + context },
          { role: "user", content: q },
        ],
      });
      return Response.json({
        answer: res.response,
        sources: [...new Set(hits.matches.map((m: any) => m.metadata.source))],
      });
    }

    return new Response("not found", { status: 404 });
}

type Chunk = { id: string; text: string; source: string };
interface Env {
  AI: any;
  VEC: any;
  TOKEN: string;
}
