import type { KanbanState } from "./types";

/**
 * Minimal subset of the Web Storage API used by the persistence helpers. Lets
 * callers pass `localStorage`, `sessionStorage`, or any compatible stub.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Resolve the default storage (`window.localStorage`) when running in a browser,
 * or `null` in non-DOM environments (SSR, tests without jsdom).
 */
function defaultStorage(): StorageLike | null {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      return (globalThis as { localStorage: StorageLike }).localStorage;
    }
  } catch {
    // Accessing localStorage can throw (e.g. blocked cookies). Treat as absent.
  }
  return null;
}

/**
 * Serialise and persist board state under `key`. Returns `true` on success and
 * `false` if no storage is available or the write failed (e.g. quota exceeded).
 */
export function saveState(
  key: string,
  state: KanbanState,
  storage: StorageLike | null = defaultStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Load board state previously saved with {@link saveState}. Returns `null` if
 * nothing is stored, storage is unavailable, or the value is not valid board
 * JSON (shape is validated, not just parsed).
 */
export function loadState(
  key: string,
  storage: StorageLike | null = defaultStorage()
): KanbanState | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isKanbanState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Remove any persisted board state stored under `key`. */
export function clearState(
  key: string,
  storage: StorageLike | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Runtime type guard that a parsed value is a structurally valid `KanbanState`.
 * Guards against corrupted or tampered storage.
 */
export function isKanbanState(value: unknown): value is KanbanState {
  if (!Array.isArray(value)) return false;
  return value.every((column) => {
    if (typeof column !== "object" || column === null) return false;
    const c = column as Record<string, unknown>;
    if (typeof c.id !== "string" || typeof c.title !== "string") return false;
    if (!Array.isArray(c.cards)) return false;
    if (c.wipLimit !== undefined && typeof c.wipLimit !== "number") return false;
    return c.cards.every((card) => {
      if (typeof card !== "object" || card === null) return false;
      const k = card as Record<string, unknown>;
      return typeof k.id === "string" && typeof k.title === "string";
    });
  });
}
