import { describe, it, expect, beforeEach } from "vitest";
import {
  saveState,
  loadState,
  clearState,
  isKanbanState,
  type StorageLike,
} from "../persistence";
import { createColumn, createCard } from "../logic";
import type { KanbanState } from "../types";

class MemoryStorage implements StorageLike {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return key in this.store ? this.store[key] : null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
}

function sample(): KanbanState {
  return [
    createColumn("todo", "To Do", [
      createCard("a", "A", { priority: "high" }),
    ], 5),
    createColumn("done", "Done", []),
  ];
}

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});

describe("saveState / loadState", () => {
  it("round-trips board state", () => {
    expect(saveState("board", sample(), storage)).toBe(true);
    const loaded = loadState("board", storage);
    expect(loaded).toEqual(sample());
  });
  it("preserves wip limits and card priority", () => {
    saveState("board", sample(), storage);
    const loaded = loadState("board", storage)!;
    expect(loaded[0].wipLimit).toBe(5);
    expect(loaded[0].cards[0].priority).toBe("high");
  });
  it("returns null when nothing is stored", () => {
    expect(loadState("missing", storage)).toBeNull();
  });
  it("returns null and does not throw on corrupt JSON", () => {
    storage.setItem("board", "{not json");
    expect(loadState("board", storage)).toBeNull();
  });
  it("returns null when stored JSON is the wrong shape", () => {
    storage.setItem("board", JSON.stringify({ not: "an array" }));
    expect(loadState("board", storage)).toBeNull();
  });
  it("returns false when no storage is available", () => {
    expect(saveState("board", sample(), null)).toBe(false);
  });
  it("returns null when loading with no storage", () => {
    expect(loadState("board", null)).toBeNull();
  });
});

describe("clearState", () => {
  it("removes a persisted entry", () => {
    saveState("board", sample(), storage);
    clearState("board", storage);
    expect(loadState("board", storage)).toBeNull();
  });
  it("is a no-op when no storage is available", () => {
    expect(() => clearState("board", null)).not.toThrow();
  });
});

describe("isKanbanState", () => {
  it("accepts a valid board", () => {
    expect(isKanbanState(sample())).toBe(true);
  });
  it("accepts an empty board", () => {
    expect(isKanbanState([])).toBe(true);
  });
  it("rejects a non-array", () => {
    expect(isKanbanState({})).toBe(false);
  });
  it("rejects a column missing cards", () => {
    expect(isKanbanState([{ id: "x", title: "X" }])).toBe(false);
  });
  it("rejects a card missing a title", () => {
    expect(
      isKanbanState([{ id: "x", title: "X", cards: [{ id: "a" }] }])
    ).toBe(false);
  });
  it("rejects a non-numeric wipLimit", () => {
    expect(
      isKanbanState([{ id: "x", title: "X", cards: [], wipLimit: "no" }])
    ).toBe(false);
  });
});
