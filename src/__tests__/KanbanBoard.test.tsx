import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { KanbanBoard } from "../KanbanBoard";
import { createColumn, createCard } from "../logic";
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

describe("<KanbanBoard /> move metadata", () => {
  it("includes fromIndex and toIndex in the CardMove", () => {
    const onCardMove = vi.fn();
    render(<KanbanBoard columns={board()} onCardMove={onCardMove} />);
    dragCardToColumn("b", "done");
    const move = onCardMove.mock.calls[0][1] as CardMove;
    expect(move).toMatchObject({
      cardId: "b",
      fromColumn: "todo",
      fromIndex: 1,
      toColumn: "done",
    });
    expect(typeof move.toIndex).toBe("number");
  });

  it("fires onChange with the next state on a move", () => {
    const onChange = vi.fn();
    render(<KanbanBoard columns={board()} onChange={onChange} />);
    dragCardToColumn("a", "done");
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as KanbanState;
    expect(next.find((c) => c.id === "done")!.cards.map((c) => c.id)).toEqual([
      "a",
    ]);
  });
});

describe("<KanbanBoard /> WIP limits", () => {
  function limited(): KanbanState {
    return [
      createColumn("todo", "To Do", [{ id: "a", title: "Card A" }]),
      createColumn("done", "Done", [{ id: "x", title: "Card X" }], 1),
    ];
  }

  it("shows a count/limit badge", () => {
    render(<KanbanBoard columns={limited()} />);
    expect(screen.getByTestId("kanban-count-done")).toHaveTextContent("1/1");
  });

  it("marks a full column with data-full", () => {
    render(<KanbanBoard columns={limited()} />);
    expect(screen.getByTestId("kanban-column-done")).toHaveAttribute(
      "data-full",
      "true"
    );
  });

  it("blocks a move into a full column and calls onMoveBlocked", () => {
    const onMoveBlocked = vi.fn();
    const onCardMove = vi.fn();
    render(
      <KanbanBoard
        columns={limited()}
        onMoveBlocked={onMoveBlocked}
        onCardMove={onCardMove}
      />
    );
    dragCardToColumn("a", "done");
    expect(onCardMove).not.toHaveBeenCalled();
    expect(onMoveBlocked).toHaveBeenCalledWith("a", "done", "wip-limit");
    // Card A is still in todo.
    expect(
      within(screen.getByTestId("kanban-column-todo")).getByTestId(
        "kanban-card-a"
      )
    ).toBeInTheDocument();
  });
});

describe("<KanbanBoard /> labels and priority", () => {
  function rich(): KanbanState {
    return [
      createColumn("todo", "To Do", [
        createCard("a", "Card A", {
          priority: "urgent",
          labels: [{ name: "bug" }, { name: "ui", color: "#f00" }],
        }),
      ]),
    ];
  }

  it("renders a priority badge", () => {
    render(<KanbanBoard columns={rich()} />);
    expect(screen.getByTestId("kanban-priority-a")).toHaveTextContent("urgent");
    expect(screen.getByTestId("kanban-card-a")).toHaveAttribute(
      "data-priority",
      "urgent"
    );
  });

  it("renders labels", () => {
    render(<KanbanBoard columns={rich()} />);
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("ui")).toBeInTheDocument();
  });
});

describe("<KanbanBoard /> editable mode", () => {
  it("adds a card via the input + button", () => {
    const onChange = vi.fn();
    render(<KanbanBoard columns={board()} editable onChange={onChange} />);
    const input = screen.getByTestId("kanban-add-input-done");
    fireEvent.change(input, { target: { value: "Fresh card" } });
    fireEvent.click(screen.getByTestId("kanban-add-button-done"));

    expect(
      within(screen.getByTestId("kanban-column-done")).getByText("Fresh card")
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("adds a card on Enter", () => {
    render(<KanbanBoard columns={board()} editable />);
    const input = screen.getByTestId("kanban-add-input-todo");
    fireEvent.change(input, { target: { value: "Typed card" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Typed card")).toBeInTheDocument();
  });

  it("ignores an empty/whitespace title", () => {
    const onChange = vi.fn();
    render(<KanbanBoard columns={board()} editable onChange={onChange} />);
    const input = screen.getByTestId("kanban-add-input-todo");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("kanban-add-button-todo"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a card via the delete button", () => {
    const onChange = vi.fn();
    render(<KanbanBoard columns={board()} editable onChange={onChange} />);
    fireEvent.click(screen.getByTestId("kanban-remove-a"));
    expect(screen.queryByTestId("kanban-card-a")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("uses a custom card factory", () => {
    render(
      <KanbanBoard
        columns={board()}
        editable
        createCardFromInput={(_col, title) => ({ id: `c-${title}`, title })}
      />
    );
    const input = screen.getByTestId("kanban-add-input-done");
    fireEvent.change(input, { target: { value: "X" } });
    fireEvent.click(screen.getByTestId("kanban-add-button-done"));
    expect(screen.getByTestId("kanban-card-c-X")).toBeInTheDocument();
  });

  it("disables the add control when the column is full", () => {
    const cols: KanbanState = [
      createColumn("done", "Done", [{ id: "x", title: "X" }], 1),
    ];
    render(<KanbanBoard columns={cols} editable />);
    expect(screen.getByTestId("kanban-add-button-done")).toBeDisabled();
  });
});

describe("<KanbanBoard /> keyboard reordering", () => {
  it("moves a focused card down within its column on ArrowDown", () => {
    const onChange = vi.fn();
    render(<KanbanBoard columns={board()} onChange={onChange} />);
    const card = screen.getByTestId("kanban-card-a");
    fireEvent.keyDown(card, { key: "ArrowDown" });
    const next = onChange.mock.calls[0][0] as KanbanState;
    expect(next.find((c) => c.id === "todo")!.cards.map((c) => c.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("ignores other keys", () => {
    const onChange = vi.fn();
    render(<KanbanBoard columns={board()} onChange={onChange} />);
    fireEvent.keyDown(screen.getByTestId("kanban-card-a"), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("exposes accessible roles on cards", () => {
    render(<KanbanBoard columns={board()} />);
    const card = screen.getByTestId("kanban-card-a");
    expect(card).toHaveAttribute("role", "button");
    expect(card).toHaveAttribute("tabindex", "0");
  });
});
