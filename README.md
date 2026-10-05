# FD Office — Stage 0 map

A small WorkAdventure map: an open studio floor where you sit at a desk, type
what you are on, walk up to people, and close the day at a threshold.

Published from the FD Office project. These are static files only — map,
tileset, script and three panels.

## Play it

**https://play.workadventu.re/_/global/fdlink.github.io/fd-office-map/office.tmj**

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
| `script.js` | SPACE to sit, close, pin, look out. Walking past a desk opens nothing. |
| `loop.js` | Shared loop rules with the rehearsal (Gate A, notes, daily surprise). |
| `sit.html` | Your card: desk mark, scene, on now, next (optional publish), hide |
| `door.html` | One line about what shipped, optional line for someone |
| `board.html` | Typed notes the floor can see (left board) |
| `roster.html` | Who is on the floor (right board) and Gate A export |
| `cafe.html` | Napkin + a line the floor can hear |
| `sill.html` | Today's view from the light well |
| `say.html` | Menu: say something |

Walk up to someone in the Café and WorkAdventure opens a camera bubble. Walk into **Meeting** and SPACE joins a Jitsi room (camera + screen share). Recording is not on this host — that waits for Stage 2 LiveKit.

## The rules the map keeps

1. Nothing appears above your head that you did not type.
2. Hide always works, and never asks why.
3. There is no idle detection.
4. There are no individual metrics. The only numbers are team numbers.
5. Presence is not productivity.

## Credits

Floor, loop and script by Yu-kai Chou's AI team. Built on
[WorkAdventure](https://workadventu.re), which is open source.
