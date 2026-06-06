import type {
  CardPriority,
  KanbanCard,
  KanbanColumn,
  KanbanState,
} from "./types";
import { PRIORITY_WEIGHT } from "./types";

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

/** Locate a column by id, or `null` if it does not exist. */
export function findColumn(
  state: KanbanState,
  columnId: string
): { index: number; column: KanbanColumn } | null {
  const index = state.findIndex((c) => c.id === columnId);
  return index === -1 ? null : { index, column: state[index] };
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
 * Whether a column is at or over its WIP limit. Columns without a `wipLimit`
 * (or with a non-positive one) are never considered "full".
 */
export function isColumnFull(column: KanbanColumn): boolean {
  return typeof column.wipLimit === "number" &&
    column.wipLimit > 0 &&
    column.cards.length >= column.wipLimit;
}

/**
 * Whether `cardId` can be accepted into `toColumn` without violating its WIP
 * limit. A card already living in `toColumn` (a same-column reorder) is always
 * allowed because it does not increase the column's size.
 */
export function canAcceptCard(
  state: KanbanState,
  cardId: string,
  toColumn: string
): boolean {
  const found = findColumn(state, toColumn);
  if (found === null) return false;
  const location = findCard(state, cardId);
  if (location && location.columnId === toColumn) return true; // reorder
  return !isColumnFull(found.column);
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
 *  - If `cardId` does not exist, `toColumn` is unknown, the position is a no-op,
 *    or the destination column is over its WIP limit, the original state
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

  // Cross-column moves must respect the destination's WIP limit.
  if (fromColumn !== toColumn && !canAcceptCard(state, cardId, toColumn)) {
    return state;
  }

  // Same column, same effective position -> no-op (preserve reference).
  if (fromColumn === toColumn) {
    const destLenAfterRemoval =
      state.find((c) => c.id === toColumn)!.cards.length - 1;
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
 * is unknown, the card id already exists anywhere on the board, or the column
 * is at its WIP limit. Never mutates the input.
 */
export function addCard(
  state: KanbanState,
  columnId: string,
  card: KanbanCard
): KanbanState {
  const found = findColumn(state, columnId);
  if (found === null) return state;
  if (findCard(state, card.id) !== null) return state; // duplicate id
  if (isColumnFull(found.column)) return state;
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
 * Shallow-merge `patch` into a card in place (returning new state). Returns the
 * original state if the card does not exist. The card's `id` cannot be changed.
 */
export function updateCard(
  state: KanbanState,
  cardId: string,
  patch: Partial<Omit<KanbanCard, "id">>
): KanbanState {
  const location = findCard(state, cardId);
  if (location === null) return state;
  return state.map((column) =>
    column.id === location.columnId
      ? {
          ...column,
          cards: column.cards.map((c) =>
            c.id === cardId ? { ...c, ...patch, id: c.id } : c
          ),
        }
      : column
  );
}

/**
 * Add a column at `index` (default: appended to the end). Returns the original
 * state if a column with the same id already exists. Never mutates the input.
 */
export function addColumn(
  state: KanbanState,
  column: KanbanColumn,
  index?: number
): KanbanState {
  if (state.some((c) => c.id === column.id)) return state;
  const target = clampIndex(index ?? state.length, state.length);
  const next = [...state];
  next.splice(target, 0, column);
  return next;
}

/**
 * Remove a column (and all of its cards). Returns the original state if the
 * column does not exist. Never mutates the input.
 */
export function removeColumn(state: KanbanState, columnId: string): KanbanState {
  if (!state.some((c) => c.id === columnId)) return state;
  return state.filter((c) => c.id !== columnId);
}

/**
 * Shallow-merge `patch` into a column (returning new state). Returns the
 * original state if the column does not exist. The column's `id` cannot change.
 */
export function updateColumn(
  state: KanbanState,
  columnId: string,
  patch: Partial<Omit<KanbanColumn, "id" | "cards">>
): KanbanState {
  if (!state.some((c) => c.id === columnId)) return state;
  return state.map((column) =>
    column.id === columnId ? { ...column, ...patch, id: column.id } : column
  );
}

/**
 * Move a whole column to a new index. Returns the original state if the column
 * does not exist or the position is unchanged. Never mutates the input.
 */
export function moveColumn(
  state: KanbanState,
  columnId: string,
  toIndex: number
): KanbanState {
  const found = findColumn(state, columnId);
  if (found === null) return state;
  const target = clampIndex(toIndex, state.length - 1);
  if (target === found.index) return state;
  const next = [...state];
  const [removed] = next.splice(found.index, 1);
  next.splice(target, 0, removed);
  return next;
}

/**
 * Sort a column's cards by priority (most urgent first). Cards without a
 * priority are treated as `low`. Stable for equal priorities. Returns the
 * original state if the column is missing or already sorted.
 */
export function sortColumnByPriority(
  state: KanbanState,
  columnId: string,
  direction: "asc" | "desc" = "desc"
): KanbanState {
  const found = findColumn(state, columnId);
  if (found === null) return state;
  const weight = (p?: CardPriority) => (p ? PRIORITY_WEIGHT[p] : 0);
  const sorted = found.column.cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const diff =
        direction === "desc"
          ? weight(b.card.priority) - weight(a.card.priority)
          : weight(a.card.priority) - weight(b.card.priority);
      return diff !== 0 ? diff : a.index - b.index; // stable
    })
    .map((entry) => entry.card);

  const unchanged = sorted.every((c, i) => c === found.column.cards[i]);
  if (unchanged) return state;

  return state.map((column) =>
    column.id === columnId ? { ...column, cards: sorted } : column
  );
}

/** Total number of cards across every column. */
export function countCards(state: KanbanState): number {
  return state.reduce((sum, column) => sum + column.cards.length, 0);
}

/**
 * Helper to construct a column with sensible defaults.
 */
export function createColumn(
  id: string,
  title: string,
  cards: KanbanCard[] = [],
  wipLimit?: number
): KanbanColumn {
  const column: KanbanColumn = { id, title, cards };
  if (typeof wipLimit === "number") column.wipLimit = wipLimit;
  return column;
}

/**
 * Helper to construct a card. Only includes optional fields that are provided
 * so equality/serialisation stays clean.
 */
export function createCard(
  id: string,
  title: string,
  options: Partial<Omit<KanbanCard, "id" | "title">> = {}
): KanbanCard {
  return { id, title, ...options };
}
