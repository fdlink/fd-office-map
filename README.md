# FD Office — Stage 0 map

A small WorkAdventure map: an open studio floor where you sit at a desk, type
what you are on, walk up to people, and close the day at a threshold.

Published from the FD Office project. These are static files only — map,
tileset, script and three panels.

## Play it

Any HTTPS host that sends CORS headers will do. With this repository on
GitHub Pages:

```
https://play.workadventu.re/_/global/<pages-host>/office.tmj
```

Locally:

```bash
python3 serve-map.py 8766      # CORS-enabled static server
./serve-public.sh              # the same, plus a cloudflared HTTPS tunnel
```

WorkAdventure fetches the map cross-origin, so a plain static server without
`Access-Control-Allow-Origin` will fail silently.

## What is in here

| File | Role |
|---|---|
| `office.tmj` / `office.json` | The map. Generated — edit the geometry spec, not this. |
| `office-tiles.png` | 32px tileset |
| `script.js` | SPACE to sit or close. Walking past a desk opens nothing. |
| `sit.html` | Your card: scene, what you are on, what is next, and hide |
| `door.html` | One line about what shipped |
| `roster.html` | Who is on the floor, their cards, and the shared day log |

## The rules the map keeps

1. Nothing appears above your head that you did not type.
2. Hide always works, and never asks why.
3. There is no idle detection.
4. There are no individual metrics. The only numbers are team numbers.
5. Presence is not productivity.

## Credits

Floor, loop and script by Yu-kai Chou's AI team. Built on
[WorkAdventure](https://workadventu.re), which is open source.
