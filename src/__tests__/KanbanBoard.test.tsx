import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { KanbanBoard } from "../KanbanBoard";
import { createColumn } from "../logic";
import type { CardMove, KanbanState } from "../types";

function board(): KanbanState {
  return [
    createColumn("todo", "To Do", [
      { id: "a", title: "Card A" },
      { id: "b", title: "Card B" },
    ]),
    createColumn("done", "Done", []),
  ];
}

/** Minimal DataTransfer stub for jsdom, which lacks one. */
class FakeDataTransfer {
  private store: Record<string, string> = {};
  dropEffect = "none";
  effectAllowed = "all";
  setData(type: string, value: string) {
    this.store[type] = value;
  }
  getData(type: string) {
    return this.store[type] ?? "";
  }
}

function dragCardToColumn(cardId: string, columnId: string) {
  const dt = new FakeDataTransfer();
  const card = screen.getByTestId(`kanban-card-${cardId}`);
  const column = screen.getByTestId(`kanban-column-${columnId}`);
  fireEvent.dragStart(card, { dataTransfer: dt });
  fireEvent.dragOver(column, { dataTransfer: dt });
  fireEvent.drop(column, { dataTransfer: dt });
}

describe("<KanbanBoard /> rendering", () => {
  it("renders all columns and their cards", () => {
    render(<KanbanBoard columns={board()} />);
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Card A")).toBeInTheDocument();
    expect(screen.getByText("Card B")).toBeInTheDocument();
  });

  it("marks cards as draggable", () => {
    render(<KanbanBoard columns={board()} />);
    expect(screen.getByTestId("kanban-card-a")).toHaveAttribute(
      "draggable",
      "true"
    );
  });

  it("supports a custom card renderer", () => {
    render(
      <KanbanBoard
        columns={board()}
        renderCard={(c) => <span>custom-{c.id}</span>}
      />
    );
    expect(screen.getByText("custom-a")).toBeInTheDocument();
  });
});

describe("<KanbanBoard /> interaction (uncontrolled)", () => {
  it("moves a card to another column and updates rendered state", () => {
    const onCardMove = vi.fn();
    render(<KanbanBoard columns={board()} onCardMove={onCardMove} />);

    const todo = screen.getByTestId("kanban-column-todo");
    const done = screen.getByTestId("kanban-column-done");
    expect(within(todo).queryByTestId("kanban-card-a")).toBeInTheDocument();
    expect(within(done).queryByTestId("kanban-card-a")).not.toBeInTheDocument();

    dragCardToColumn("a", "done");

    // Card A now lives in the Done column.
    expect(
      within(screen.getByTestId("kanban-column-done")).getByTestId(
        "kanban-card-a"
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("kanban-column-todo")).queryByTestId(
        "kanban-card-a"
      )
    ).not.toBeInTheDocument();

    expect(onCardMove).toHaveBeenCalledTimes(1);
    const move = onCardMove.mock.calls[0][1] as CardMove;
    expect(move).toMatchObject({ cardId: "a", fromColumn: "todo", toColumn: "done" });
  });
});

describe("<KanbanBoard /> interaction (controlled)", () => {
  it("does not move internally; relies on parent to update columns", () => {
    const onCardMove = vi.fn();
    const cols = board();
    render(<KanbanBoard columns={cols} controlled onCardMove={onCardMove} />);

    dragCardToColumn("a", "done");

    // Controlled: DOM still reflects the unchanged `columns` prop.
    expect(
      within(screen.getByTestId("kanban-column-todo")).getByTestId(
        "kanban-card-a"
      )
    ).toBeInTheDocument();
    // But the callback fired with the computed next state.
    expect(onCardMove).toHaveBeenCalledTimes(1);
    const nextState = onCardMove.mock.calls[0][0] as KanbanState;
    expect(nextState.find((c) => c.id === "done")!.cards.map((c) => c.id)).toEqual([
      "a",
    ]);
  });
});
