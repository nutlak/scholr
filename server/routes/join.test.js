import { test } from "node:test";
import assert from "node:assert/strict";
import { classPin, normalizePin } from "./join.js";

test("PINs are 6 unambiguous characters and stable per class", () => {
  const id = "3f1c2a9e-0000-4000-8000-000000000001";
  const pin = classPin(id);
  assert.match(pin, /^[2-9A-HJKMNP-Z]{6}$/);
  assert.equal(classPin(id), pin);
  assert.notEqual(classPin("3f1c2a9e-0000-4000-8000-000000000002"), pin);
});

test("normalizePin forgives case, spaces and dashes", () => {
  assert.equal(normalizePin(" ab3-x7q "), "AB3X7Q");
});
