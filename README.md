<div align="center">
  <img src="docs/assets/logo.png" alt="react-kanban-board logo" width="160" />

  <h1>react-kanban-board</h1>

  <p><strong>Kanban board with draggable cards across columns for React.</strong></p>

  <p><em>Built and maintained by Viprasol Tech</em></p>

  <p>
    <a href="https://github.com/Viprasol-Tech/react-kanban-board/actions"><img src="https://github.com/Viprasol-Tech/react-kanban-board/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT" /></a>
    <a href="https://www.npmjs.com/package/react-kanban-board"><img src="https://img.shields.io/npm/v/react-kanban-board.svg" alt="npm version" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-blue.svg" alt="TypeScript strict" /></a>
  </p>
</div>

---

## Features

- **Drag cards between columns** using native HTML5 drag-and-drop — no extra runtime dependencies.
- **Pure, testable core** — the `moveCard(state, cardId, toColumn, toIndex)` reducer is a side-effect-free function you can unit test or reuse on the server.
- **Controlled or uncontrolled** — let the board manage its own state, or drive it entirely from props via `onCardMove`.
- **Immutable updates** — moves never mutate your state; unchanged columns keep their reference identity for cheap memoization.
- **Custom card rendering** with the `renderCard` prop.
- **Strict TypeScript** with full type definitions shipped in `dist`.
- **Accessible markup** — ARIA roles, labels, and `aria-grabbed` on cards.

## Install

```bash
npm i react-kanban-board
```

`react` and `react-dom` (>= 18) are peer dependencies.

## Usage

```tsx
import { useState } from "react";
import { KanbanBoard, createColumn } from "react-kanban-board";
import type { KanbanState, CardMove } from "react-kanban-board";

export function Board() {
  const [columns, setColumns] = useState<KanbanState>([
    createColumn("todo", "To Do", [
      { id: "1", title: "Design API", description: "Draft the public surface" },
      { id: "2", title: "Write tests" },
    ]),
    createColumn("doing", "In Progress", [
      { id: "3", title: "Implement reducer" },
    ]),
    createColumn("done", "Done", []),
  ]);

  return (
    <KanbanBoard
      columns={columns}
      controlled
      onCardMove={(next: KanbanState, move: CardMove) => {
        setColumns(next);
        console.log(`moved ${move.cardId} -> ${move.toColumn}@${move.toIndex}`);
      }}
    />
  );
}
```

Prefer the board to own its state? Drop `controlled` and it will update itself, calling `onCardMove` with the new state after each move:

```tsx
<KanbanBoard columns={initialColumns} onCardMove={(next) => save(next)} />
```

### Using the reducer directly

```ts
import { moveCard } from "react-kanban-board";

const next = moveCard(state, "card-1", "done", 0);
// `next` is a new array; `state` is untouched.
```

## API

### `<KanbanBoard />` props

| Prop         | Type                                              | Default | Description                                                                 |
| ------------ | ------------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| `columns`    | `KanbanState`                                      | —       | Columns to render (initial state when uncontrolled).                        |
| `controlled` | `boolean`                                          | `false` | When `true`, the board renders exactly `columns`; update them in `onCardMove`. |
| `onCardMove` | `(nextState: KanbanState, move: CardMove) => void` | —       | Fired after a successful move with the resulting state and the move details. |
| `renderCard` | `(card: KanbanCard) => ReactNode`                  | —       | Custom renderer for the card body.                                          |
| `className`  | `string`                                           | —       | Extra class appended to the board container.                               |

### Exported functions

| Function                                          | Description                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `moveCard(state, cardId, toColumn, toIndex)`      | Pure reducer; returns new state with the card moved (clamped, immutable). |
| `findCard(state, cardId)`                         | Locate a card's column id, index, and object (or `null`).               |
| `clampIndex(index, length)`                       | Clamp an insertion index into `[0, length]`.                            |
| `addCard(state, columnId, card)`                  | Append a card to a column (immutable).                                  |
| `removeCard(state, cardId)`                       | Remove a card from anywhere on the board (immutable).                   |
| `createColumn(id, title, cards?)`                 | Convenience column constructor.                                         |

### Types

`KanbanCard`, `KanbanColumn`, `KanbanState`, `CardMove`, `KanbanBoardProps` are all exported.

## Note

The component ships unstyled markup with stable class names (`kanban-board`, `kanban-column`, `kanban-card`, `kanban-card--dragging`, …) so you can bring your own CSS or design system. The drag interaction relies on the browser's native HTML5 drag-and-drop, keeping the bundle dependency-free.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). Open an issue to discuss substantial changes before submitting a PR.

## Contact — Viprasol Tech Private Limited

- Website: [viprasol.com](https://viprasol.com)
- Email: [support@viprasol.com](mailto:support@viprasol.com)
- Telegram: [t.me/viprasol_help](https://t.me/viprasol_help) | WhatsApp: +91 96336 52112
- GitHub: [@Viprasol-Tech](https://github.com/Viprasol-Tech) | [LinkedIn](https://www.linkedin.com/in/viprasol/) | X [@viprasol](https://twitter.com/viprasol)

## License

[MIT](LICENSE) (c) 2025 Viprasol Tech Private Limited
