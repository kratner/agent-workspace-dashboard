# Branding

Working files for the Agent Workspace Dashboard icon and the Keith Ratner "KR" mark.

![Concepts at 128, 32 and 16 px on dark and light backgrounds](preview/sheet.png)

## Idea

The brand colors are the dashboard's own state colors: amber means a session is waiting on you, blue means working, green means idle. They sit on a deep ink-blue tile. So the icon, the KR mark and the product all use one color system, and amber is the accent ("this needs you").

## Palette

| Role | Hex | Used for |
| --- | --- | --- |
| Ink (top) | `#262B57` | Tile gradient start |
| Ink (bottom) | `#0D1022` | Tile gradient end |
| Paper | `#F4F5FB` | Letterforms on ink |
| Signal amber | `#F5A524` | Accent; "waiting on you" |
| Working blue | `#4F7CFF` | Secondary accent; "working" |
| Idle green | `#2BD4A4` | Tertiary; "idle" |

The tile is a 128 × 128 rounded square, corner radius 28, with the gradient running top-left to bottom-right. Strokes in the KR marks are round-capped and of even weight.

## Concepts

| File | Concept |
| --- | --- |
| `icon/a-board.svg` | Three Kanban columns; the single glowing amber card is the session waiting on you. |
| `icon/b-stack.svg` | Three session rows with status dots, like the List view; the waiting row is outlined. |
| `icon/c-pulse.svg` | Board columns with a live heartbeat line crossing them. |
| `kr/kr-monoline.svg` | K and R in one even stroke; R's leg in amber. |
| `kr/kr-brackets.svg` | The same KR between blue code chevrons. |
| `kr/kr-signal.svg` | The same KR with an amber status dot. |

## Rendering

```sh
npm run brand
```

This renders every SVG in `icon/` and `kr/` to `preview/<group>-<name>-128.png` and `-512.png`, and draws `preview/sheet.png`, which shows each mark at 128, 32 and 16 px on dark and light backgrounds. Edit an SVG, re-run the command and check the sheet. Small sizes are where icons fail.

The extension's Marketplace icon is a 128 × 128 PNG referenced from `package.json` (`"icon"`). When one concept is chosen, it gets rendered there. Nothing in `branding/` ships in the `.vsix`.
