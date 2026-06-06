import { useCallback, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import type { CardMove, KanbanCard, KanbanState } from "./types";
import { findCard, moveCard } from "./logic";

const DRAG_MIME = "application/x-kanban-card-id";

export interface KanbanBoardProps {
  /** Initial columns when used as an uncontrolled component. */
  columns: KanbanState;
  /**
   * When provided, the board is controlled: it renders exactly `columns` and
   * never holds internal state. You must update `columns` from `onCardMove`.
   */
  controlled?: boolean;
  /** Fired after a successful move with the resulting board state and move. */
  onCardMove?: (nextState: KanbanState, move: CardMove) => void;
  /** Optional custom renderer for a card's body. */
  renderCard?: (card: KanbanCard) => ReactNode;
  /** Extra class on the outer board container. */
  className?: string;
}

/**
 * A Kanban board whose cards can be dragged between columns using native
 * HTML5 drag-and-drop. The actual reordering is delegated to the pure
 * `moveCard` reducer so the same logic is unit-testable in isolation.
 */
export function KanbanBoard({
  columns,
  controlled = false,
  onCardMove,
  renderCard,
  className,
}: KanbanBoardProps): JSX.Element {
  const [internal, setInternal] = useState<KanbanState>(columns);
  const state = controlled ? columns : internal;

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const applyMove = useCallback(
    (cardId: string, toColumn: string, toIndex: number) => {
      const before = controlled ? columns : internal;
      const location = findCard(before, cardId);
      if (location === null) return;

      const next = moveCard(before, cardId, toColumn, toIndex);
      if (next === before) return;

      if (!controlled) setInternal(next);

      onCardMove?.(next, {
        cardId,
        fromColumn: location.columnId,
        toColumn,
        toIndex,
      });
    },
    [controlled, columns, internal, onCardMove]
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

  const onDragEnd = useCallback(() => setDraggingId(null), []);

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
    },
    [applyMove, draggingId]
  );

  const onDropOnColumn = useCallback(
    (event: DragEvent<HTMLElement>, columnId: string) => {
      event.preventDefault();
      const cardId = readCardId(event);
      if (!cardId) return;
      const column = state.find((c) => c.id === columnId);
      const toIndex = column ? column.cards.length : 0;
      applyMove(cardId, columnId, toIndex);
      setDraggingId(null);
    },
    [applyMove, state, draggingId]
  );

  const allowDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  return (
    <div
      className={className ? `kanban-board ${className}` : "kanban-board"}
      data-testid="kanban-board"
      role="list"
      aria-label="Kanban board"
    >
      {state.map((column) => (
        <section
          key={column.id}
          className="kanban-column"
          data-testid={`kanban-column-${column.id}`}
          data-column-id={column.id}
          role="listitem"
          aria-label={column.title}
          onDragOver={allowDrop}
          onDrop={(event) => onDropOnColumn(event, column.id)}
        >
          <header className="kanban-column__header">{column.title}</header>
          <div className="kanban-column__cards">
            {column.cards.map((card, index) => (
              <div
                key={card.id}
                className={
                  draggingId === card.id
                    ? "kanban-card kanban-card--dragging"
                    : "kanban-card"
                }
                data-testid={`kanban-card-${card.id}`}
                data-card-id={card.id}
                draggable
                aria-grabbed={draggingId === card.id}
                onDragStart={(event) => onDragStart(event, card.id)}
                onDragEnd={onDragEnd}
                onDragOver={allowDrop}
                onDrop={(event) => onDropOnCard(event, column.id, index)}
              >
                {renderCard ? (
                  renderCard(card)
                ) : (
                  <>
                    <div className="kanban-card__title">{card.title}</div>
                    {card.description ? (
                      <div className="kanban-card__description">
                        {card.description}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
