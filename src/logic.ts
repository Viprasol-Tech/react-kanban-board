import type { KanbanCard, KanbanColumn, KanbanState } from "./types";

/**
 * Locate a card and its position within the board.
 *
 * @returns the owning column id, the card index within that column, and the
 *   card object, or `null` if no card with `cardId` exists.
 */
export function findCard(
  state: KanbanState,
  cardId: string
): { columnId: string; index: number; card: KanbanCard } | null {
  for (const column of state) {
    const index = column.cards.findIndex((c) => c.id === cardId);
    if (index !== -1) {
      return { columnId: column.id, index, card: column.cards[index] };
    }
  }
  return null;
}

/**
 * Clamp an insertion index into the inclusive range `[0, length]`.
 * An insertion index may legally equal the array length (append).
 */
export function clampIndex(index: number, length: number): number {
  if (Number.isNaN(index)) return length;
  if (index < 0) return 0;
  if (index > length) return length;
  return Math.trunc(index);
}

/**
 * Pure reducer that moves a card to a target column at a target index.
 *
 * Guarantees:
 *  - The card is removed from its source column.
 *  - The card is inserted at `toIndex` in the destination column (clamped to a
 *    valid insertion range, accounting for same-column removal shift).
 *  - The original state is never mutated; new arrays/objects are returned for
 *    every column that changes. Unchanged columns keep their identity.
 *  - If `cardId` does not exist, or `toColumn` is unknown, the original state
 *    reference is returned unchanged.
 *
 * @param state    current board state
 * @param cardId   id of the card to move
 * @param toColumn destination column id
 * @param toIndex  destination insertion index within `toColumn`
 */
export function moveCard(
  state: KanbanState,
  cardId: string,
  toColumn: string,
  toIndex: number
): KanbanState {
  const location = findCard(state, cardId);
  if (location === null) return state;

  const destExists = state.some((c) => c.id === toColumn);
  if (!destExists) return state;

  const { columnId: fromColumn, index: fromIndex, card } = location;

  // Same column, same effective position -> no-op (preserve reference).
  if (fromColumn === toColumn) {
    const destLenAfterRemoval = state.find((c) => c.id === toColumn)!.cards.length - 1;
    const clamped = clampIndex(toIndex, destLenAfterRemoval);
    if (clamped === fromIndex) return state;
  }

  return state.map((column) => {
    if (column.id === fromColumn && column.id === toColumn) {
      // Move within the same column: remove then insert into the shrunk list.
      const without = column.cards.filter((c) => c.id !== cardId);
      const target = clampIndex(toIndex, without.length);
      const nextCards = [...without];
      nextCards.splice(target, 0, card);
      return { ...column, cards: nextCards };
    }

    if (column.id === fromColumn) {
      return {
        ...column,
        cards: column.cards.filter((c) => c.id !== cardId),
      };
    }

    if (column.id === toColumn) {
      const target = clampIndex(toIndex, column.cards.length);
      const nextCards = [...column.cards];
      nextCards.splice(target, 0, card);
      return { ...column, cards: nextCards };
    }

    return column;
  });
}

/**
 * Append a card to the end of a column. Returns state unchanged if the column
 * is unknown. Never mutates the input.
 */
export function addCard(
  state: KanbanState,
  columnId: string,
  card: KanbanCard
): KanbanState {
  if (!state.some((c) => c.id === columnId)) return state;
  return state.map((column) =>
    column.id === columnId
      ? { ...column, cards: [...column.cards, card] }
      : column
  );
}

/**
 * Remove a card from wherever it lives. Returns state unchanged if not found.
 * Never mutates the input.
 */
export function removeCard(state: KanbanState, cardId: string): KanbanState {
  const location = findCard(state, cardId);
  if (location === null) return state;
  return state.map((column) =>
    column.id === location.columnId
      ? { ...column, cards: column.cards.filter((c) => c.id !== cardId) }
      : column
  );
}

/**
 * Helper to construct a column with sensible defaults.
 */
export function createColumn(
  id: string,
  title: string,
  cards: KanbanCard[] = []
): KanbanColumn {
  return { id, title, cards };
}
