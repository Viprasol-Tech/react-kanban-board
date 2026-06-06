/**
 * A single card on the board.
 */
export interface KanbanCard {
  /** Unique identifier across the entire board. */
  id: string;
  /** Title shown on the card face. */
  title: string;
  /** Optional longer description. */
  description?: string;
}

/**
 * A column (lane) that holds an ordered list of cards.
 */
export interface KanbanColumn {
  /** Unique identifier across the entire board. */
  id: string;
  /** Heading shown above the column. */
  title: string;
  /** Ordered cards contained in this column. */
  cards: KanbanCard[];
}

/**
 * The full board state: an ordered list of columns.
 */
export type KanbanState = KanbanColumn[];

/**
 * Describes a single card move from its current location to a target column
 * and index. Emitted by `<KanbanBoard onCardMove>`.
 */
export interface CardMove {
  cardId: string;
  fromColumn: string;
  toColumn: string;
  toIndex: number;
}
