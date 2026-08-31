import assert from "node:assert";
import { chunk } from "./ingest.mjs";

const p = "x".repeat(100);
assert.equal(chunk(`${p}\n\n${p}`, 1000).length, 1, "small doc stays one chunk");
assert.equal(chunk(`${p}\n\n${p}`, 150).length, 2, "splits on paragraph when over max");
assert.ok(chunk("y".repeat(5000), 1000).length >= 5, "hard-splits a single huge paragraph");
assert.ok(chunk("y".repeat(5000), 1000).every((c) => c.length <= 1000), "no chunk exceeds max");
assert.equal(chunk("").length, 0, "empty input yields nothing");
console.log("ok");
