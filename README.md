# WorkAdventure — production Stage 0

Consensus: this is the crew test. `../rehearsal/` is a laptop preview only.

## What's in this folder

| File | Role |
|---|---|
| `office.tmj` / `office.json` | Tiled map generated from `../rehearsal/layout.json` |
| `office-tiles.png` | 32px studio tileset (wall / desk / café / meeting collide) |
| `script.js` | **SPACE** to sit or close. Walking through a desk does not auto-open a modal. |
| `sit.html` | Scene + on now / next. Hide clears public state |
| `door.html` | Close line |
| `roster.html` | Who is on the floor, their typed cards, and the shared Gate A count |
| `serve-map.py` | Static server **with CORS** (WorkAdventure fetches the map cross-origin) |
| `serve-public.sh` | `serve-map.py` + cloudflared, so `play.workadventu.re` can load it |

Same Gate A shape as the rehearsal export: `{ day, name, arrived, closed, closeLine }`.

## Run it

```bash
./serve-public.sh
```

Then open the URL it prints:
`https://play.workadventu.re/_/global/<trycloudflare-host>/office.tmj`

Do not leave the tunnel running unattended. A trycloudflare host is a new
address every run, so it is fine for a look and wrong for a two-week crew
test — see "Making it permanent".

Regenerate the map after editing `../rehearsal/layout.json`:

```bash
python3 ../scripts/build-assets.py
```

## Making it permanent (Yu-kai's call, not started)

Gate A needs one address the crew opens every morning for two weeks. A tunnel
cannot be that. The map is static files, so any HTTPS host with CORS works —
GitHub Pages is the cheapest and `gh` is already authenticated on this Mac.
It needs a **public** repo on the free plan, so it is a publish, and nobody
has approved one. Nothing has been created.

## Gate A (do not hire on this map)

60% of crew, sit **and** Door, 4 of 5 weekdays, two weeks. Fail → stop. Cap < $100.

## Charter (hard)

Nothing above a head that they did not type. Hide clears scene + on-now. No idle.
Presence is not productivity. SPACE is the sit/close beat (same job as **E** in
the rehearsal).

## Verified 2026-09-23 (Claude)

Served over a cloudflared tunnel and loaded into `play.workadventu.re`:
map resolves, `office.tmj` returns 200, Phaser boots, no parse or validation
errors. **Not yet verified in-room** — WorkAdventure bundles terms-of-use
acceptance into its name prompt, which is Yu-kai's to accept, not Claude's.
First person in should check: SPACE at a desk opens the sheet, the board opens
the roster, and a second player appears in it.
