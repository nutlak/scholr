import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRounds } from "./quizOptions.js";

const deck = [
  { front: "Q1", back: "A1" }, { front: "Q2", back: "A2" }, { front: "Q3", back: "A3" },
  { front: "Q4", back: "A4" }, { front: "Q5", back: "a1 " },
];

test("each round has its own answer at `correct` and up to 4 distinct options", () => {
  for (const r of buildRounds(deck)) {
    assert.equal(r.options[r.correct], r.back);
    assert.ok(r.options.length <= 4 && r.options.length >= 3);
    assert.equal(new Set(r.options.map(o => o.trim().toLowerCase())).size, r.options.length, "no duplicate-looking options");
  }
});

test("a 3-card deck still works with 3 options", () => {
  const rounds = buildRounds(deck.slice(0, 3));
  assert.ok(rounds.every(r => r.options.length === 3 && r.options[r.correct] === r.back));
});
