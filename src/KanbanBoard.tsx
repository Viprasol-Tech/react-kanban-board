import { useCallback, useState } from "react";
import type { DragEvent, KeyboardEvent, ReactNode } from "react";
import type {
  BlockReason,
  CardMove,
  KanbanCard,
  KanbanState,
} from "./types";
import { canAcceptCard, findCard, isColumnFull, moveCard } from "./logic";

const DRAG_MIME = "application/x-kanban-card-id";

export interface KanbanBoardProps {
  /** Initial columns when used as an uncontrolled component. */
  columns: KanbanState;
  /**
   * When provided, the board is controlled: it renders exactly `columns` and
   * never holds internal state. You must update `columns` from `onChange` /
   * `onCardMove`.
   */
  controlled?: boolean;
  /** Fired after a successful move with the resulting board state and move. */
  onCardMove?: (nextState: KanbanState, move: CardMove) => void;
  /**
   * Fired after ANY successful state change (move, add, remove) with the next
   * board state. The canonical callback for persistence.
   */
  onChange?: (nextState: KanbanState) => void;
  /**
   * Fired when a mutation is rejected (e.g. a WIP limit would be exceeded), so
   * the host can surface feedback.
   */
  onMoveBlocked?: (cardId: string, toColumn: string, reason: BlockReason) => void;
  /** Optional custom renderer for a card's body. */
  renderCard?: (card: KanbanCard) => ReactNode;
  /**
   * When `true`, shows a "+ Add card" control in each column and a delete
   * button on each card. Defaults to `false`.
   */
  editable?: boolean;
  /**
   * Called to mint a card from raw title text typed into the add-card control.
   * Defaults to `{ id: crypto.randomUUID(), title }`.
   */
  createCardFromInput?: (columnId: string, title: string) => KanbanCard;
  /** Extra class on the outer board container. */
  className?: string;
}

function defaultCardFactory(_columnId: string, title: string): KanbanCard {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, title };
}

/**
 * A Kanban board whose cards can be dragged between and within columns using
 * native HTML5 drag-and-drop. Supports WIP limits, card labels/priority,
 * inline add/remove, keyboard reordering, and a single `onChange` callback for
 * persistence. The reordering itself is delegated to the pure `moveCard`
 * reducer so the same logic is unit-testable in isolation.
 */
export function KanbanBoard({
  columns,
  controlled = false,
  onCardMove,
  onChange,
  onMoveBlocked,
  renderCard,
  editable = false,
  createCardFromInput = defaultCardFactory,
  className,
}: KanbanBoardProps): JSX.Element {
  const [internal, setInternal] = useState<KanbanState>(columns);
  const state = controlled ? columns : internal;

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const commit = useCallback(
    (next: KanbanState) => {
      if (!controlled) setInternal(next);
      onChange?.(next);
    },
    [controlled, onChange]
  );

  const applyMove = useCallback(
    (cardId: string, toColumn: string, toIndex: number) => {
      const before = controlled ? columns : internal;
      const location = findCard(before, cardId);
      if (location === null) return;

      if (!canAcceptCard(before, cardId, toColumn)) {
        onMoveBlocked?.(cardId, toColumn, "wip-limit");
        return;
      }

      const next = moveCard(before, cardId, toColumn, toIndex);
      if (next === before) return;

      commit(next);
      onCardMove?.(next, {
        cardId,
        fromColumn: location.columnId,
        fromIndex: location.index,
        toColumn,
        toIndex,
      });
    },
    [controlled, columns, internal, onCardMove, onMoveBlocked, commit]
  );

  const onDragStart = useCallback(
    (event: DragEvent<HTMLElement>, cardId: string) => {
      event.dataTransfer.setData(DRAG_MIME, cardId);
      event.dataTransfer.setData("text/plain", cardId);
      event.dataTransfer.effectAllowed = "move";
      setDraggingId(cardId);
    },
    []
  );

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setOverColumn(null);
  }, []);

  const readCardId = (event: DragEvent): string =>
    event.dataTransfer.getData(DRAG_MIME) ||
    event.dataTransfer.getData("text/plain") ||
    draggingId ||
    "";

  const onDropOnCard = useCallback(
    (event: DragEvent<HTMLElement>, columnId: string, index: number) => {
      event.preventDefault();
      event.stopPropagation();
      const cardId = readCardId(event);
      if (cardId) applyMove(cardId, columnId, index);
      setDraggingId(null);
      setOverColumn(null);
    },
    [applyMove, draggingId]
  );

  const onDropOnColumn = useCallback(
    (event: DragEvent<HTMLElement>, columnId: string) => {
      event.preventDefault();
      const cardId = readCardId(event);
      if (cardId) {
        const column = state.find((c) => c.id === columnId);
        const toIndex = column ? column.cards.length : 0;
        applyMove(cardId, columnId, toIndex);
      }
      setDraggingId(null);
      setOverColumn(null);
    },
    [applyMove, state, draggingId]
  );

  const allowDrop = useCallback(
    (event: DragEvent<HTMLElement>, columnId: string) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (overColumn !== columnId) setOverColumn(columnId);
    },
    [overColumn]
  );

  const removeCardAt = useCallback(
    (cardId: string) => {
      const before = controlled ? columns : internal;
      const location = findCard(before, cardId);
      if (location === null) return;
      const next = before.map((column) =>
        column.id === location.columnId
          ? { ...column, cards: column.cards.filter((c) => c.id !== cardId) }
          : column
      );
      commit(next);
    },
    [controlled, columns, internal, commit]
  );

  const addCardToColumn = useCallback(
    (columnId: string) => {
      const title = (drafts[columnId] ?? "").trim();
      if (!title) return;
      const before = controlled ? columns : internal;
      const column = before.find((c) => c.id === columnId);
      if (!column) return;
      if (isColumnFull(column)) {
        onMoveBlocked?.("", columnId, "wip-limit");
        return;
      }
      const card = createCardFromInput(columnId, title);
      const next = before.map((c) =>
        c.id === columnId ? { ...c, cards: [...c.cards, card] } : c
      );
      commit(next);
      setDrafts((d) => ({ ...d, [columnId]: "" }));
    },
    [drafts, controlled, columns, internal, createCardFromInput, commit, onMoveBlocked]
  );

  // Keyboard reordering: move focused card up/down within its column.
  const onCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, cardId: string) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const before = controlled ? columns : internal;
      const location = findCard(before, cardId);
      if (location === null) return;
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? -1 : 1;
      applyMove(cardId, location.columnId, location.index + delta);
    },
    [controlled, columns, internal, applyMove]
  );

  return (
    <div
      className={className ? `kanban-board ${className}` : "kanban-board"}
      data-testid="kanban-board"
      role="list"
      aria-label="Kanban board"
    >
      {state.map((column) => {
        const full = isColumnFull(column);
        const isOver = overColumn === column.id;
        const columnClass = [
          "kanban-column",
          full ? "kanban-column--full" : "",
          isOver ? "kanban-column--over" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <section
            key={column.id}
            className={columnClass}
            data-testid={`kanban-column-${column.id}`}
            data-column-id={column.id}
            data-full={full ? "true" : "false"}
            role="listitem"
            aria-label={column.title}
            onDragOver={(event) => allowDrop(event, column.id)}
            onDrop={(event) => onDropOnColumn(event, column.id)}
          >
            <header className="kanban-column__header">
              <span className="kanban-column__title">{column.title}</span>
              <span
                className="kanban-column__count"
                data-testid={`kanban-count-${column.id}`}
              >
                {typeof column.wipLimit === "number"
                  ? `${column.cards.length}/${column.wipLimit}`
                  : column.cards.length}
              </span>
            </header>
            <ul
              className="kanban-column__cards"
              role="list"
              aria-label={`${column.title} cards`}
            >
              {column.cards.map((card, index) => (
                <li
                  key={card.id}
                  className={[
                    "kanban-card",
                    draggingId === card.id ? "kanban-card--dragging" : "",
                    card.priority ? `kanban-card--${card.priority}` : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-testid={`kanban-card-${card.id}`}
                  data-card-id={card.id}
                  data-priority={card.priority ?? ""}
                  draggable
                  tabIndex={0}
                  role="button"
                  aria-roledescription="Draggable card"
                  aria-grabbed={draggingId === card.id}
                  aria-label={card.title}
                  onDragStart={(event) => onDragStart(event, card.id)}
                  onDragEnd={onDragEnd}
                  onDragOver={(event) => allowDrop(event, column.id)}
                  onDrop={(event) => onDropOnCard(event, column.id, index)}
                  onKeyDown={(event) => onCardKeyDown(event, card.id)}
                >
                  {renderCard ? (
                    renderCard(card)
                  ) : (
                    <>
                      {card.priority ? (
                        <span
                          className={`kanban-card__priority kanban-card__priority--${card.priority}`}
                          data-testid={`kanban-priority-${card.id}`}
                        >
                          {card.priority}
                        </span>
                      ) : null}
                      <div className="kanban-card__title">{card.title}</div>
                      {card.description ? (
                        <div className="kanban-card__description">
                          {card.description}
                        </div>
                      ) : null}
                      {card.labels && card.labels.length > 0 ? (
                        <div className="kanban-card__labels">
                          {card.labels.map((label) => (
                            <span
                              key={label.name}
                              className="kanban-card__label"
                              style={
                                label.color
                                  ? { backgroundColor: label.color }
                                  : undefined
                              }
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                  {editable ? (
                    <button
                      type="button"
                      className="kanban-card__remove"
                      data-testid={`kanban-remove-${card.id}`}
                      aria-label={`Remove ${card.title}`}
                      onClick={() => removeCardAt(card.id)}
                    >
                      &times;
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {editable ? (
              <div className="kanban-column__add">
                <input
                  type="text"
                  className="kanban-column__add-input"
                  data-testid={`kanban-add-input-${column.id}`}
                  aria-label={`New card title for ${column.title}`}
                  placeholder="New card title"
                  value={drafts[column.id] ?? ""}
                  disabled={full}
                  onChange={(event) =>
                    setDrafts((d) => ({ ...d, [column.id]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addCardToColumn(column.id);
                  }}
                />
                <button
                  type="button"
                  className="kanban-column__add-button"
                  data-testid={`kanban-add-button-${column.id}`}
                  aria-label={`Add card to ${column.title}`}
                  disabled={full}
                  onClick={() => addCardToColumn(column.id)}
                >
                  + Add card
                </button>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
