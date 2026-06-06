import { describe, it, expect } from "vitest";
import {
  moveCard,
  findCard,
  clampIndex,
  addCard,
  removeCard,
  createColumn,
} from "../logic";
import type { KanbanState } from "../types";

function sampleState(): KanbanState {
  return [
    createColumn("todo", "To Do", [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
      { id: "c", title: "C" },
    ]),
    createColumn("doing", "Doing", [{ id: "d", title: "D" }]),
    createColumn("done", "Done", []),
  ];
}

const ids = (state: KanbanState, col: string): string[] =>
  state.find((c) => c.id === col)!.cards.map((c) => c.id);

describe("clampIndex", () => {
  it("clamps below zero to zero", () => {
    expect(clampIndex(-5, 3)).toBe(0);
  });
  it("clamps above length to length", () => {
    expect(clampIndex(99, 3)).toBe(3);
  });
  it("keeps an in-range value", () => {
    expect(clampIndex(2, 3)).toBe(2);
  });
  it("treats NaN as append", () => {
    expect(clampIndex(NaN, 4)).toBe(4);
  });
  it("truncates fractional indices", () => {
    expect(clampIndex(1.9, 5)).toBe(1);
  });
});

describe("findCard", () => {
  it("finds a card and its position", () => {
    const found = findCard(sampleState(), "b");
    expect(found).not.toBeNull();
    expect(found!.columnId).toBe("todo");
    expect(found!.index).toBe(1);
    expect(found!.card.title).toBe("B");
  });
  it("returns null for an unknown card", () => {
    expect(findCard(sampleState(), "zzz")).toBeNull();
  });
});

describe("moveCard across columns", () => {
  it("removes from source and inserts at target index", () => {
    const next = moveCard(sampleState(), "a", "done", 0);
    expect(ids(next, "todo")).toEqual(["b", "c"]);
    expect(ids(next, "done")).toEqual(["a"]);
  });

  it("inserts at a non-zero target index in destination", () => {
    const start = sampleState();
    const withTwo = addCard(start, "done", { id: "x", title: "X" });
    const next = moveCard(withTwo, "b", "done", 1);
    expect(ids(next, "todo")).toEqual(["a", "c"]);
    expect(ids(next, "done")).toEqual(["x", "b"]);
  });

  it("clamps an out-of-range target index to append", () => {
    const next = moveCard(sampleState(), "a", "doing", 999);
    expect(ids(next, "doing")).toEqual(["d", "a"]);
  });

  it("does not mutate the original state", () => {
    const start = sampleState();
    const snapshot = JSON.stringify(start);
    moveCard(start, "a", "done", 0);
    expect(JSON.stringify(start)).toBe(snapshot);
  });

  it("returns the same reference when card is unknown", () => {
    const start = sampleState();
    expect(moveCard(start, "nope", "done", 0)).toBe(start);
  });

  it("returns the same reference when destination column is unknown", () => {
    const start = sampleState();
    expect(moveCard(start, "a", "ghost", 0)).toBe(start);
  });

  it("keeps unchanged columns by identity", () => {
    const start = sampleState();
    const next = moveCard(start, "a", "done", 0);
    const startDoing = start.find((c) => c.id === "doing");
    const nextDoing = next.find((c) => c.id === "doing");
    expect(nextDoing).toBe(startDoing);
  });
});

describe("moveCard within the same column", () => {
  it("reorders earlier-to-later accounting for removal shift", () => {
    // move "a" (index 0) to index 2 within todo
    const next = moveCard(sampleState(), "a", "todo", 2);
    expect(ids(next, "todo")).toEqual(["b", "c", "a"]);
  });

  it("reorders later-to-earlier", () => {
    const next = moveCard(sampleState(), "c", "todo", 0);
    expect(ids(next, "todo")).toEqual(["c", "a", "b"]);
  });

  it("is a no-op (same reference) when target equals current position", () => {
    const start = sampleState();
    expect(moveCard(start, "b", "todo", 1)).toBe(start);
  });
});

describe("addCard / removeCard", () => {
  it("appends a card to a column", () => {
    const next = addCard(sampleState(), "done", { id: "z", title: "Z" });
    expect(ids(next, "done")).toEqual(["z"]);
  });
  it("ignores add to unknown column (same reference)", () => {
    const start = sampleState();
    expect(addCard(start, "ghost", { id: "z", title: "Z" })).toBe(start);
  });
  it("removes a card from wherever it lives", () => {
    const next = removeCard(sampleState(), "d");
    expect(ids(next, "doing")).toEqual([]);
  });
  it("ignores remove of unknown card (same reference)", () => {
    const start = sampleState();
    expect(removeCard(start, "nope")).toBe(start);
  });
});
