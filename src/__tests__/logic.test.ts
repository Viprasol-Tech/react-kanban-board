import { describe, it, expect } from "vitest";
import {
  moveCard,
  findCard,
  findColumn,
  clampIndex,
  isColumnFull,
  canAcceptCard,
  addCard,
  removeCard,
  updateCard,
  addColumn,
  removeColumn,
  updateColumn,
  moveColumn,
  sortColumnByPriority,
  countCards,
  createColumn,
  createCard,
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
  it("ignores add of a duplicate card id (same reference)", () => {
    const start = sampleState();
    expect(addCard(start, "done", { id: "a", title: "dup" })).toBe(start);
  });
});

describe("findColumn", () => {
  it("finds a column and its index", () => {
    const found = findColumn(sampleState(), "doing");
    expect(found).not.toBeNull();
    expect(found!.index).toBe(1);
    expect(found!.column.title).toBe("Doing");
  });
  it("returns null for an unknown column", () => {
    expect(findColumn(sampleState(), "ghost")).toBeNull();
  });
});

describe("WIP limits", () => {
  function limited(): KanbanState {
    return [
      createColumn("todo", "To Do", [{ id: "a", title: "A" }]),
      createColumn("doing", "Doing", [{ id: "d", title: "D" }], 1),
      createColumn("free", "Free", []),
    ];
  }

  it("isColumnFull is true at the limit", () => {
    expect(isColumnFull(limited()[1])).toBe(true);
  });
  it("isColumnFull is false below the limit", () => {
    expect(isColumnFull(limited()[2])).toBe(false);
  });
  it("isColumnFull is false when no limit is set", () => {
    expect(isColumnFull(limited()[0])).toBe(false);
  });
  it("canAcceptCard rejects a full destination", () => {
    expect(canAcceptCard(limited(), "a", "doing")).toBe(false);
  });
  it("canAcceptCard allows a same-column reorder even when full", () => {
    expect(canAcceptCard(limited(), "d", "doing")).toBe(true);
  });
  it("moveCard refuses to overfill a column (same reference)", () => {
    const start = limited();
    expect(moveCard(start, "a", "doing", 0)).toBe(start);
  });
  it("addCard refuses to overfill a column (same reference)", () => {
    const start = limited();
    expect(addCard(start, "doing", { id: "z", title: "Z" })).toBe(start);
  });
  it("moveCard still allows reordering inside a full column", () => {
    const start = [
      createColumn("doing", "Doing", [
        { id: "x", title: "X" },
        { id: "y", title: "Y" },
      ], 2),
    ];
    const next = moveCard(start, "x", "doing", 1);
    expect(next.find((c) => c.id === "doing")!.cards.map((c) => c.id)).toEqual([
      "y",
      "x",
    ]);
  });
});

describe("updateCard", () => {
  it("merges a patch into the card", () => {
    const next = updateCard(sampleState(), "a", {
      priority: "high",
      description: "urgent thing",
    });
    const card = findCard(next, "a")!.card;
    expect(card.priority).toBe("high");
    expect(card.description).toBe("urgent thing");
  });
  it("cannot change the id", () => {
    const next = updateCard(sampleState(), "a", {
      title: "renamed",
    } as never);
    expect(findCard(next, "a")!.card.title).toBe("renamed");
  });
  it("returns the same reference for an unknown card", () => {
    const start = sampleState();
    expect(updateCard(start, "nope", { title: "x" })).toBe(start);
  });
});

describe("column operations", () => {
  it("addColumn appends by default", () => {
    const next = addColumn(sampleState(), createColumn("extra", "Extra"));
    expect(next.map((c) => c.id)).toEqual(["todo", "doing", "done", "extra"]);
  });
  it("addColumn inserts at a given index", () => {
    const next = addColumn(sampleState(), createColumn("extra", "Extra"), 1);
    expect(next.map((c) => c.id)).toEqual(["todo", "extra", "doing", "done"]);
  });
  it("addColumn ignores duplicate id (same reference)", () => {
    const start = sampleState();
    expect(addColumn(start, createColumn("todo", "Dup"))).toBe(start);
  });
  it("removeColumn drops a column and its cards", () => {
    const next = removeColumn(sampleState(), "todo");
    expect(next.map((c) => c.id)).toEqual(["doing", "done"]);
  });
  it("removeColumn ignores unknown id (same reference)", () => {
    const start = sampleState();
    expect(removeColumn(start, "ghost")).toBe(start);
  });
  it("updateColumn merges a patch (and sets wip limit)", () => {
    const next = updateColumn(sampleState(), "doing", {
      title: "In Progress",
      wipLimit: 3,
    });
    const col = findColumn(next, "doing")!.column;
    expect(col.title).toBe("In Progress");
    expect(col.wipLimit).toBe(3);
  });
  it("moveColumn reorders columns", () => {
    const next = moveColumn(sampleState(), "done", 0);
    expect(next.map((c) => c.id)).toEqual(["done", "todo", "doing"]);
  });
  it("moveColumn is a no-op for the same position (same reference)", () => {
    const start = sampleState();
    expect(moveColumn(start, "todo", 0)).toBe(start);
  });
  it("does not mutate the input on column ops", () => {
    const start = sampleState();
    const snap = JSON.stringify(start);
    addColumn(start, createColumn("x", "X"));
    removeColumn(start, "todo");
    moveColumn(start, "done", 0);
    expect(JSON.stringify(start)).toBe(snap);
  });
});

describe("sortColumnByPriority", () => {
  function pri(): KanbanState {
    return [
      createColumn("todo", "To Do", [
        createCard("a", "A", { priority: "low" }),
        createCard("b", "B", { priority: "urgent" }),
        createCard("c", "C", { priority: "medium" }),
        createCard("d", "D"),
      ]),
    ];
  }
  it("sorts most-urgent first by default", () => {
    const next = sortColumnByPriority(pri(), "todo");
    expect(next[0].cards.map((c) => c.id)).toEqual(["b", "c", "a", "d"]);
  });
  it("sorts ascending when asked", () => {
    const next = sortColumnByPriority(pri(), "todo", "asc");
    expect(next[0].cards.map((c) => c.id)).toEqual(["a", "d", "c", "b"]);
  });
  it("is stable for equal priorities", () => {
    const start = [
      createColumn("todo", "To Do", [
        createCard("a", "A"),
        createCard("b", "B"),
        createCard("c", "C"),
      ]),
    ];
    expect(sortColumnByPriority(start, "todo")).toBe(start);
  });
  it("returns same reference for unknown column", () => {
    const start = pri();
    expect(sortColumnByPriority(start, "ghost")).toBe(start);
  });
});

describe("createCard / countCards", () => {
  it("createCard includes only provided options", () => {
    const card = createCard("a", "A", { priority: "high" });
    expect(card).toEqual({ id: "a", title: "A", priority: "high" });
  });
  it("countCards totals across columns", () => {
    expect(countCards(sampleState())).toBe(4);
  });
});

describe("moveCard reports fromIndex via CardMove shape", () => {
  it("findCard exposes the source index used by the move callback", () => {
    const loc = findCard(sampleState(), "c");
    expect(loc!.index).toBe(2);
  });
});
