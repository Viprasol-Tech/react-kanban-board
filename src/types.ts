/**
 * Priority level for a card. Ordered from least to most urgent so it can be
 * compared and sorted (`low < medium < high < urgent`).
 */
export type CardPriority = "low" | "medium" | "high" | "urgent";

/**
 * A coloured label/tag attached to a card.
 */
export interface CardLabel {
  /** Short text shown on the chip (e.g. "bug", "design"). */
  name: string;
  /** Optional CSS colour used for the chip background. */
  color?: string;
}

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
  /** Optional priority used for styling/sorting. */
  priority?: CardPriority;
  /** Optional coloured labels/tags. */
  labels?: CardLabel[];
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
  /**
   * Optional Work-In-Progress limit. When set and the column already holds at
   * least this many cards, moves/adds into the column are rejected by the pure
   * reducers and the column renders an "over limit" affordance.
   */
  wipLimit?: number;
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
  fromIndex: number;
  toColumn: string;
  toIndex: number;
}

/**
 * Reason a mutation was blocked. Surfaced via `onChange`'s second argument and
 * the `onMoveBlocked` callback so hosts can show feedback (e.g. a toast).
 */
export type BlockReason = "wip-limit";

/**
 * Numeric weight for each priority, used for sorting (higher = more urgent).
 */
export const PRIORITY_WEIGHT: Record<CardPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};
