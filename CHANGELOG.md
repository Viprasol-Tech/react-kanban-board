# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/); versioning
follows [SemVer](https://semver.org/).

## [0.2.0] - 2025

### Added
- **WIP limits** per column (`wipLimit`). Moves and adds that would overfill a
  column are rejected by the pure reducers; the column renders an "over limit"
  affordance and a `count/limit` badge.
- **Card labels and priority**: `CardLabel[]` chips and a `CardPriority`
  (`low | medium | high | urgent`) badge, with `PRIORITY_WEIGHT` for sorting.
- **Editable mode** (`editable`) — inline "+ Add card" input/button per column
  and a delete button on each card.
- **Keyboard reordering** — focus a card and use ArrowUp / ArrowDown to move it
  within its column. Cards expose `role="button"`, `tabIndex`, and
  `aria-roledescription`.
- **Single `onChange` callback** that fires after any successful mutation (move,
  add, remove) — the canonical hook for persistence.
- `onMoveBlocked(cardId, toColumn, reason)` callback for rejected mutations.
- `CardMove` now carries `fromIndex` alongside `fromColumn`/`toColumn`/`toIndex`.
- New pure helpers: `findColumn`, `isColumnFull`, `canAcceptCard`, `updateCard`,
  `addColumn`, `removeColumn`, `updateColumn`, `moveColumn`,
  `sortColumnByPriority`, `countCards`, `createCard`.
- **Persistence helpers**: `saveState`, `loadState`, `clearState`, and the
  `isKanbanState` runtime guard, accepting any `StorageLike` (default
  `localStorage`). Corrupt/invalid storage is handled gracefully.

### Changed
- `addCard` now refuses duplicate card ids and respects the destination's WIP
  limit.
- Roughly tripled the test suite (26 → 87 tests) across logic, persistence, and
  component render/interaction.

## [0.1.0] - 2025

### Added
- Initial release of react-kanban-board: Kanban board with draggable cards across columns for React.
