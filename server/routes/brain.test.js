import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBrainMap } from "./brain.js";

test("parseBrainMap dedupes, drops bad links, tolerates prose around the JSON", () => {
  const raw = `Here you go: {"concepts":[{"name":"Cell","summary":"s"},{"name":"cell","summary":"dup"},{"name":"Mitosis"},{"name":"DNA"}],
    "links":[["Cell","Mitosis"],["mitosis","cell"],["DNA","Nope"],["DNA","DNA"],["dna","Mitosis"]]} thanks`;
  const map = parseBrainMap(raw);
  assert.deepEqual(map.concepts.map(c => c.name), ["Cell", "Mitosis", "DNA"]);
  assert.equal(map.concepts[1].summary, "");
  assert.deepEqual(map.links, [[0, 1], [2, 1]]);
});

test("parseBrainMap rejects too few concepts and junk", () => {
  assert.equal(parseBrainMap('{"concepts":[{"name":"A"},{"name":"B"}]}'), null);
  assert.equal(parseBrainMap("no json here"), null);
  assert.equal(parseBrainMap("{not json}"), null);
});

test("parseBrainMap caps at 12 concepts", () => {
  const concepts = Array.from({ length: 20 }, (_, i) => ({ name: `C${i}` }));
  assert.equal(parseBrainMap({ concepts }).concepts.length, 12);
});
