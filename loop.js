/* FD Office Stage 0 — loop rules. Browser + node.
   Names follow the loop: sitAtDesk, closeDayAtDoor, teamStreak.
   v2 (2026-09-23, Claude): day-scoped leaving, path finding, presence freshness. */

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FdOfficeLoop = api;
})(typeof self !== "undefined" ? self : this, function () {
  const BLOCKS = { "#": true, c: true, m: true, d: true };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function shiftDay(key, delta) {
    const parts = key.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] + delta);
    return todayKey(d);
  }

  function mergeClose(closes, day, name) {
    const next = Object.assign({}, closes);
    const names = next[day] ? next[day].slice() : [];
    if (name && names.indexOf(name) === -1) names.push(name);
    next[day] = names;
    return next;
  }

  function teamStreak(closes, today) {
    let streak = 0;
    let key = today;
    for (let i = 0; i < 60; i++) {
      const names = closes[key] || [];
      if (names.length === 0) {
        if (i === 0) {
          key = shiftDay(key, -1);
          continue;
        }
        break;
      }
      streak += 1;
      key = shiftDay(key, -1);
    }
    return streak;
  }

  function publicStatus(hidden, scene, onNow) {
    if (hidden) return { scene: "", onNow: "" };
    return { scene: scene || "", onNow: onNow || "" };
  }

  function yesterdayCloseHint(lastClose, lastCloseDay, today) {
    if (!lastClose) return "";
    if (lastCloseDay === today) return "";
    return lastClose;
  }

  function upsertLog(log, entry) {
    const out = log.slice();
    const i = out.findIndex(function (row) {
      if (row.day !== entry.day) return false;
      if (entry.id && row.id === entry.id) return true;
      return entry.name && row.name === entry.name;
    });
    if (i < 0) {
      out.push({
        day: entry.day,
        name: entry.name || "",
        id: entry.id || "",
        arrived: !!entry.arrived,
        closed: !!entry.closed,
        closeLine: entry.closeLine || ""
      });
      return out;
    }
    const prev = out[i];
    out[i] = {
      day: entry.day,
      name: entry.name || prev.name,
      id: entry.id || prev.id,
      arrived: !!(prev.arrived || entry.arrived),
      closed: !!(prev.closed || entry.closed),
      closeLine: entry.closeLine || prev.closeLine || ""
    };
    return out;
  }

  function gateAToday(log, day) {
    const arrived = {};
    const closed = {};
    log.forEach(function (row) {
      if (row.day !== day) return;
      if (row.arrived) arrived[row.name] = true;
      if (row.closed) closed[row.name] = true;
    });
    return {
      arrived: Object.keys(arrived).length,
      closed: Object.keys(closed).length
    };
  }

  /* Gate A is "both beats, by 60% of the crew, on 4 of 5 weekdays, two weeks".
     One place that answers it, so the rehearsal and the map cannot disagree. */
  function gateAScore(log, crewSize, days) {
    const need = Math.ceil((crewSize || 1) * 0.6);
    const byDay = {};
    log.forEach(function (row) {
      if (!byDay[row.day]) byDay[row.day] = {};
      const who = byDay[row.day][row.name] || { arrived: false, closed: false };
      who.arrived = who.arrived || !!row.arrived;
      who.closed = who.closed || !!row.closed;
      byDay[row.day][row.name] = who;
    });
    const rows = (days || Object.keys(byDay).sort()).map(function (day) {
      const people = byDay[day] || {};
      const both = Object.keys(people).filter(function (n) {
        return people[n].arrived && people[n].closed;
      }).length;
      return { day: day, both: both, pass: both >= need };
    });
    return {
      need: need,
      days: rows,
      passedDays: rows.filter(function (r) { return r.pass; }).length
    };
  }

  /* Last 10 weekdays ending at `today` (two work weeks). Weekend days skipped. */
  function lastWeekdays(today, n) {
    n = n || 10;
    const out = [];
    let key = today;
    let guard = 0;
    while (out.length < n && guard < 40) {
      const parts = key.split("-").map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) out.unshift(key);
      key = shiftDay(key, -1);
      guard += 1;
    }
    return out;
  }

  function gateATwoWeeks(log, crewSize, today) {
    const days = lastWeekdays(today, 10);
    const score = gateAScore(log, crewSize, days);
    score.window = days;
    score.pass = score.passedDays >= 8;
    return score;
  }

  function tileAt(layout, px, py) {
    const tile = layout.tile;
    const col = Math.floor(px / tile);
    const row = Math.floor(py / tile);
    if (row < 0 || col < 0 || row >= layout.rows || col >= layout.cols) return "#";
    return layout.collision[row].charAt(col);
  }

  function blocksWalk(ch) {
    return !!BLOCKS[ch];
  }

  function canWalk(layout, px, py) {
    const points = [
      [px + 8, py + 10],
      [px + 24, py + 10],
      [px + 8, py + 28],
      [px + 24, py + 28]
    ];
    for (let i = 0; i < points.length; i++) {
      if (blocksWalk(tileAt(layout, points[i][0], points[i][1]))) return false;
    }
    return true;
  }

  function tileWalkable(layout, col, row) {
    if (row < 0 || col < 0 || row >= layout.rows || col >= layout.cols) return false;
    return !blocksWalk(layout.collision[row].charAt(col));
  }

  function tileOf(layout, px, py) {
    return {
      col: Math.floor((px + 14) / layout.tile),
      row: Math.floor((py + 14) / layout.tile)
    };
  }

  /* Click-to-walk without this just presses the avatar into the desk it is
     sitting behind. Breadth-first over the same grid collision uses. */
  function findPath(layout, fromPx, toPx) {
    const start = tileOf(layout, fromPx.x, fromPx.y);
    let goal = tileOf(layout, toPx.x, toPx.y);
    if (!tileWalkable(layout, goal.col, goal.row)) {
      const near = nearestWalkable(layout, goal);
      if (!near) return [];
      goal = near;
    }
    if (start.col === goal.col && start.row === goal.row) {
      return [pixelFor(layout, goal.col, goal.row)];
    }
    const key = function (c, r) { return c + "," + r; };
    const prev = {};
    const seen = {};
    const queue = [start];
    seen[key(start.col, start.row)] = true;
    while (queue.length) {
      const at = queue.shift();
      if (at.col === goal.col && at.row === goal.row) {
        const out = [];
        let step = at;
        while (step) {
          out.unshift(pixelFor(layout, step.col, step.row));
          step = prev[key(step.col, step.row)];
        }
        out.shift();
        return out;
      }
      const moves = [
        { col: at.col + 1, row: at.row },
        { col: at.col - 1, row: at.row },
        { col: at.col, row: at.row + 1 },
        { col: at.col, row: at.row - 1 }
      ];
      for (let i = 0; i < moves.length; i++) {
        const next = moves[i];
        const k = key(next.col, next.row);
        if (seen[k] || !tileWalkable(layout, next.col, next.row)) continue;
        seen[k] = true;
        prev[k] = at;
        queue.push(next);
      }
    }
    return [];
  }

  function nearestWalkable(layout, goal) {
    for (let radius = 1; radius <= 6; radius++) {
      for (let dc = -radius; dc <= radius; dc++) {
        for (let dr = -radius; dr <= radius; dr++) {
          const col = goal.col + dc;
          const row = goal.row + dr;
          if (tileWalkable(layout, col, row)) return { col: col, row: row };
        }
      }
    }
    return null;
  }

  /* One reading of "what day is this person in", so closing cannot strand
     anybody past midnight. */
  function dayState(self, today) {
    self = self || {};
    return {
      arrivedToday: self.arrivedDay === today,
      closedToday: self.lastCloseDay === today,
      offFloor: self.leftDay === today
    };
  }

  function zoneAt(layout, px, py) {
    const tile = layout.tile;
    const col = Math.floor(px / tile);
    const row = Math.floor(py / tile);
    const desk = layout.desks.find(function (d) {
      return Math.abs(d.col - col) <= 1 && Math.abs(d.row - row) <= 1;
    });
    if (desk) return { kind: "desk", desk: desk };
    const keys = Object.keys(layout.zones);
    for (let i = 0; i < keys.length; i++) {
      const z = layout.zones[keys[i]];
      if (col >= z.col && col < z.col + z.w && row >= z.row && row < z.row + z.h) {
        return { kind: z.kind || keys[i], zone: z };
      }
    }
    return { kind: "floor" };
  }

  function promptFor(zone, extra) {
    extra = extra || {};
    if (zone.kind === "desk") {
      if (extra.occupant && extra.occupant.name) {
        return "E — leave a note for " + extra.occupant.name;
      }
      return "E — sit at " + zone.desk.name;
    }
    if (zone.kind === "door") return "E — close the day";
    if (zone.kind === "board") return "E — leave a note";
    if (zone.kind === "sill") return "E — look out";
    if (zone.kind === "cafe") {
      if (extra.cafeCount >= 2) return "Café — you are here with others. E leaves a napkin";
      return "Café — walk up to talk. E leaves a napkin";
    }
    if (zone.kind === "meeting") {
      if (extra.meetCount >= 2) return "Meeting — you are here with others. E leaves an agenda";
      return "Meeting — E leaves today's agenda";
    }
    if (extra.nearby && extra.nearby.name) {
      return "E — say something to " + extra.nearby.name;
    }
    return "";
  }

  /* ---------- Right-brain 357 helpers (CD3 create, CD5 social, CD7 surprise) ---------- */

  function clipLine(text, max) {
    const s = String(text || "").replace(/\s+/g, " ").trim();
    max = max || 80;
    if (s.length <= max) return s;
    return s.slice(0, max);
  }

  function parseJsonSafe(raw, fallback) {
    if (raw == null || raw === "") return fallback;
    if (typeof raw !== "string") return raw;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function sitAllowed(name, onNow, hidden) {
    if (!clipLine(name, 24)) return { ok: false, focus: "name" };
    if (!hidden && !clipLine(onNow, 80)) return { ok: false, focus: "onNow" };
    return { ok: true };
  }

  function pinNote(notes, entry, cap) {
    cap = cap || 24;
    const next = (notes || []).slice();
    const note = {
      day: entry && entry.day ? entry.day : "",
      name: clipLine(entry && entry.name, 24),
      text: clipLine(entry && entry.text, 80),
      forWhom: clipLine(entry && entry.forWhom, 24),
      kind: (entry && entry.kind) || "board"
    };
    if (!note.text) return next;
    next.push(note);
    return next.slice(-cap);
  }

  function notesForYou(notes, name) {
    const n = clipLine(name, 24).toLowerCase();
    if (!n) return [];
    return (notes || []).filter(function (note) {
      return clipLine(note.forWhom, 24).toLowerCase() === n;
    });
  }

  function dailySeed(day) {
    let h = 2166136261;
    const s = String(day || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const SURPRISES = [
    { id: "airplane", prop: "airplane", line: "A paper airplane landed on the café table.", sill: "A folded plane hangs in the light well." },
    { id: "rain", prop: "rain", line: "Rain beads on the sill. The floor is quieter.", sill: "The hills beyond the water are a wash of grey-green." },
    { id: "cat", prop: "cat", line: "A cat found the plant. It is not on the roster.", sill: "Something small is asleep on the far ledge." },
    { id: "gold", prop: "gold", line: "The light shaft is warmer than usual.", sill: "Gold pools on the threshold like someone left it on." },
    { id: "cup", prop: "cup", line: "Someone left a cup in the café. Still warm, maybe.", sill: "Steam ghosts the glass for a second, then nothing." },
    { id: "fins", prop: "fins", line: "The overhead fins hum, just once.", sill: "A paper on the board fins lifts, then settles." },
    { id: "island", prop: "island", line: "If you look out, the island is a little closer.", sill: "The island sits on the horizon like a held breath." }
  ];

  function surpriseForDay(day) {
    const seed = dailySeed(day);
    return SURPRISES[seed % SURPRISES.length];
  }

  function firstOpener(log, day) {
    const rows = (log || []).filter(function (row) {
      return row.day === day && row.arrived && row.name;
    });
    if (!rows.length) return "";
    return rows[0].name;
  }

  function openerRecord(current, day, name) {
    current = current || {};
    if (current.day === day && current.name) return { day: day, name: current.name };
    const who = clipLine(name, 24);
    if (!who) return { day: day, name: current.day === day ? (current.name || "") : "" };
    return { day: day, name: who };
  }

  function closedTogether(log, day) {
    const names = [];
    (log || []).forEach(function (row) {
      if (row.day === day && row.closed && row.name && names.indexOf(row.name) === -1) {
        names.push(row.name);
      }
    });
    return names;
  }

  function nearbyPerson(px, py, others, radius) {
    radius = radius || 56;
    let best = null;
    let bestD = radius;
    (others || []).forEach(function (person) {
      if (!person || person.offFloor) return;
      const d = Math.hypot((person.x || 0) - px, (person.y || 0) - py);
      if (d > 4 && d < bestD) {
        best = person;
        bestD = d;
      }
    });
    return best;
  }

  function huddleLabel(cafeCount, meetCount) {
    if (cafeCount >= 2) return "Café huddle";
    if (meetCount >= 2) return "Meeting huddle";
    return "";
  }

  function sayBubble(name, text, now, ttl) {
    const line = clipLine(text, 40);
    if (!line) return null;
    return {
      name: clipLine(name, 24),
      text: line,
      until: (now || Date.now()) + (ttl || 6000)
    };
  }

  function bubbleAlive(bubble, now) {
    if (!bubble || !bubble.text) return false;
    return (bubble.until || 0) > (now || Date.now());
  }

  function plantScale(streak) {
    if (streak >= 5) return 1.25;
    if (streak >= 3) return 1.1;
    if (streak >= 1) return 1;
    return 0;
  }

  function publicCard(hidden, scene, onNow, next, publishNext) {
    const pub = publicStatus(hidden, scene, onNow);
    pub.next = hidden || !publishNext ? "" : (next || "");
    return pub;
  }

  function closeGift(from, to, text, day) {
    const who = clipLine(to, 24);
    const line = clipLine(text, 80);
    if (!who || !line) return null;
    return { day: day || "", name: clipLine(from, 24), forWhom: who, text: line, kind: "gift" };
  }

  /* Another person on the floor already claimed this desk. Leave a note
     rather than sit in their chair. Self is skipped so you can update your card. */
  function occupantOf(deskId, people, selfId) {
    if (!deskId) return null;
    people = people || [];
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (!p || p.offFloor) continue;
      if (selfId && p.id === selfId) continue;
      if (p.claimedDesk !== deskId) continue;
      return p;
    }
    return null;
  }

  function hourWash(hour) {
    if (hour == null || hour === undefined) hour = new Date().getHours();
    if (hour < 6 || hour >= 20) return { id: "night", fill: "rgba(12,22,48,0.32)" };
    if (hour < 8) return { id: "dawn", fill: "rgba(232,140,80,0.14)" };
    if (hour >= 17) return { id: "dusk", fill: "rgba(196,90,50,0.16)" };
    return { id: "day", fill: "rgba(255,236,180,0.05)" };
  }

  function sillArt(surprise) {
    const id = surprise && surprise.id ? surprise.id : "island";
    return "sill-" + id + ".jpg";
  }

  function agendaLine(from, text, day) {
    const line = clipLine(text, 80);
    if (!line) return null;
    return { day: day || "", name: clipLine(from, 24), text: line, kind: "agenda" };
  }

  function bindEnterSubmit(root) {
    if (!root || (root.getAttribute && root.getAttribute("data-fd-enter"))) return;
    if (root.setAttribute) root.setAttribute("data-fd-enter", "1");
    root.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      const tag = event.target && event.target.tagName;
      if (tag === "TEXTAREA") return;
      event.preventDefault();
      const btn = root.querySelector("button.primary, button.door");
      if (btn) btn.click();
    });
  }

  function pixelFor(layout, col, row) {
    return { x: col * layout.tile, y: row * layout.tile };
  }

  function validateLayout(layout) {
    const errors = [];
    if (!layout || layout.cols !== 32 || layout.rows !== 18) {
      errors.push("layout must be 32×18");
    }
    if (!layout.collision || layout.collision.length !== layout.rows) {
      errors.push("collision row count");
    } else {
      layout.collision.forEach(function (line, i) {
        if (line.length !== layout.cols) {
          errors.push("row " + i + " length " + line.length);
        }
      });
    }
    (layout && layout.desks ? layout.desks : []).forEach(function (desk) {
      if (!tileWalkable(layout, desk.col, desk.row)) {
        errors.push("desk " + desk.id + " is not reachable");
      }
    });
    const zones = (layout && layout.zones) || {};
    Object.keys(zones).forEach(function (name) {
      const z = zones[name];
      let open = 0;
      for (let c = z.col; c < z.col + z.w; c++) {
        for (let r = z.row; r < z.row + z.h; r++) {
          if (tileWalkable(layout, c, r)) open += 1;
        }
      }
      if (open === 0) errors.push("zone " + name + " has no tile you can stand on");
    });
    return errors;
  }

  return {
    todayKey: todayKey,
    shiftDay: shiftDay,
    mergeClose: mergeClose,
    teamStreak: teamStreak,
    publicStatus: publicStatus,
    yesterdayCloseHint: yesterdayCloseHint,
    upsertLog: upsertLog,
    gateAToday: gateAToday,
    gateAScore: gateAScore,
    lastWeekdays: lastWeekdays,
    gateATwoWeeks: gateATwoWeeks,
    tileAt: tileAt,
    blocksWalk: blocksWalk,
    canWalk: canWalk,
    tileWalkable: tileWalkable,
    tileOf: tileOf,
    findPath: findPath,
    dayState: dayState,
    zoneAt: zoneAt,
    promptFor: promptFor,
    pixelFor: pixelFor,
    validateLayout: validateLayout,
    clipLine: clipLine,
    parseJsonSafe: parseJsonSafe,
    sitAllowed: sitAllowed,
    pinNote: pinNote,
    notesForYou: notesForYou,
    dailySeed: dailySeed,
    surpriseForDay: surpriseForDay,
    firstOpener: firstOpener,
    openerRecord: openerRecord,
    closedTogether: closedTogether,
    nearbyPerson: nearbyPerson,
    huddleLabel: huddleLabel,
    sayBubble: sayBubble,
    bubbleAlive: bubbleAlive,
    plantScale: plantScale,
    publicCard: publicCard,
    closeGift: closeGift,
    occupantOf: occupantOf,
    hourWash: hourWash,
    sillArt: sillArt,
    agendaLine: agendaLine,
    bindEnterSubmit: bindEnterSubmit
  };
});
