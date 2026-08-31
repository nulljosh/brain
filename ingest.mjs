#!/usr/bin/env node
// Walks the Obsidian wiki + every roadmap.md, chunks, POSTs to /ingest.
// usage: BRAIN_TOKEN=... node ingest.mjs [--dry]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";

const WIKI = join(homedir(), "Library/Mobile Documents/iCloud~md~obsidian/Documents/Code");
const CODE = join(homedir(), "Documents/Code");
const ROOTS = [WIKI, CODE];
const URL_BASE = process.env.BRAIN_URL ?? "https://brain.trommatic.workers.dev";
const MAX = 1500; // chars; bge-base handles ~512 tokens

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

// split on blank lines, greedily packing paragraphs up to MAX chars
export function chunk(text, max = MAX) {
  const out = [];
  let buf = "";
  for (const para of text.split(/\n{2,}/)) {
    if (buf && buf.length + para.length > max) {
      out.push(buf);
      buf = "";
    }
    buf = buf ? `${buf}\n\n${para}` : para;
    while (buf.length > max) {
      out.push(buf.slice(0, max));
      buf = buf.slice(max);
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

function collect() {
  const files = [];
  for (const root of ROOTS) {
    try {
      for (const f of walk(root)) {
        // from ~/Documents/Code take only roadmaps + CLAUDE.md; the wiki root takes everything
        if (root === CODE && !/\/(roadmap|CLAUDE|README)\.md$/i.test(f)) continue;
        files.push(f);
      }
    } catch {}
  }
  const chunks = [];
  for (const f of files) {
    const src = f.replace(homedir(), "~");
    for (const text of chunk(readFileSync(f, "utf8"))) {
      if (text.trim().length < 40) continue;
      chunks.push({ id: createHash("sha1").update(src + text).digest("hex"), text, source: src });
    }
  }
  return chunks;
}

async function main() {
  const chunks = collect();
  console.log(`${chunks.length} chunks`);
  if (process.argv.includes("--dry")) return console.log(chunks.slice(0, 2));
  for (let i = 0; i < chunks.length; i += 50) {
    const batch = chunks.slice(i, i + 50);
    const r = await fetch(`${URL_BASE}/ingest`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.BRAIN_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ chunks: batch }),
    });
    console.log(i, r.status, await r.text());
    if (!r.ok) process.exit(1);
  }
}

if (process.argv[1]?.endsWith("ingest.mjs")) main();
