import { test } from "node:test";
import assert from "node:assert/strict";

// Presence context tells you a friend is "studying Bio 101". The rule that
// keeps that from being a leak: a notebook title is only ever revealed to a
// viewer who is already a member of that notebook. This mirrors the filter in
// visibleActiveNotebooks().
function visibleTo(viewerNotebookIds, friends, titles) {
  const allowed = new Set(viewerNotebookIds);
  return friends.map(f => ({
    userId: f.userId,
    activeNotebook:
      f.isOnline && f.lastNotebookId && allowed.has(f.lastNotebookId)
        ? { id: f.lastNotebookId, title: titles[f.lastNotebookId] }
        : null,
  }));
}

const titles = { nb1: "Bio 101", nb2: "Private Diary" };

test("reveals a notebook the viewer shares", () => {
  const out = visibleTo(["nb1"], [{ userId: "u1", isOnline: true, lastNotebookId: "nb1" }], titles);
  assert.deepEqual(out[0].activeNotebook, { id: "nb1", title: "Bio 101" });
});

test("never reveals a notebook the viewer is not in", () => {
  const out = visibleTo(["nb1"], [{ userId: "u1", isOnline: true, lastNotebookId: "nb2" }], titles);
  assert.equal(out[0].activeNotebook, null, "leaked a notebook the viewer cannot open");
});

test("reveals nothing for an offline friend", () => {
  const out = visibleTo(["nb1"], [{ userId: "u1", isOnline: false, lastNotebookId: "nb1" }], titles);
  assert.equal(out[0].activeNotebook, null);
});

test("a viewer in no notebooks learns nothing", () => {
  const friends = [
    { userId: "u1", isOnline: true, lastNotebookId: "nb1" },
    { userId: "u2", isOnline: true, lastNotebookId: "nb2" },
  ];
  assert.deepEqual(visibleTo([], friends, titles).map(f => f.activeNotebook), [null, null]);
});

test("handles a friend with no recorded notebook", () => {
  const out = visibleTo(["nb1"], [{ userId: "u1", isOnline: true, lastNotebookId: null }], titles);
  assert.equal(out[0].activeNotebook, null);
});
