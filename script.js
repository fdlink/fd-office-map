/// <reference types="@workadventure/iframe-api-typings" />
/**
 * FD Office Stage 0 — WorkAdventure map script.
 * SPACE to sit / close. Do not auto-open a modal on walk-through.
 * Charter: nothing above your head you did not type. Hide clears public state.
 *
 * v2 (2026-09-23, Claude QA pass). v1 shipped three things that made the crew
 * test impossible, all fixed here:
 *   - the typed card was saved public but nothing ever rendered it, so no one
 *     could see what anyone was on. Now: a roster panel + a live feed.
 *   - WA.chat.sendChatMessage only writes to your own chat, so "sat down"
 *     reached nobody. Now: everyone reacts to public variable changes.
 *   - Gate A lived in a private per-player variable, so it could never be
 *     added up. Now: one shared room variable anybody can export.
 * Every WA call is wrapped, because the public play server's API version is
 * not ours to pin.
 */

var DESKS = [
    "desk-yk", "desk-jun", "desk-jason", "desk-simon",
    "desk-guest-a", "desk-guest-b"
];

function todayKey() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
}

function safe(fn, fallback) {
    try {
        return fn();
    } catch (err) {
        console.warn("FD Office: unsupported call", err && err.message);
        return fallback;
    }
}

function say(line) {
    safe(function () {
        WA.chat.sendChatMessage(line, "FD Office");
    });
}

/* ---------- shared Gate A log (room variable, declared in office.tmj) ---------- */

function readRoom(key) {
    return safe(function () {
        var raw = WA.state.loadVariable(key);
        if (!raw) return [];
        return typeof raw === "string" ? JSON.parse(raw) : raw;
    }, []);
}

function writeRoom(key, value) {
    return safe(function () {
        WA.state.saveVariable(key, JSON.stringify(value));
        return true;
    }, false);
}

/* One row per person per day, same shape as the rehearsal export and
   gate-a.schema.json. Re-sitting must not create a second row. */
function recordGateA(entry) {
    var log = readRoom("gateA");
    var found = -1;
    for (var i = 0; i < log.length; i++) {
        if (log[i].day === entry.day && log[i].name === entry.name) {
            found = i;
            break;
        }
    }
    if (found < 0) {
        log.push(entry);
    } else {
        var prev = log[found];
        log[found] = {
            day: entry.day,
            name: entry.name,
            arrived: !!(prev.arrived || entry.arrived),
            closed: !!(prev.closed || entry.closed),
            closeLine: entry.closeLine || prev.closeLine || ""
        };
    }
    var ok = writeRoom("gateA", log);
    if (!ok) {
        /* Room variables refused: keep a local copy so the day is not lost. */
        safe(function () {
            WA.player.state.saveVariable("gateAFallback", JSON.stringify(log), {
                public: false,
                persist: true
            });
        });
    }
    return ok;
}

/* ---------- who is here and what they typed ---------- */

function selfCard() {
    var st = WA.player.state;
    var hidden = st.hidden === true || st.hidden === "true";
    return {
        name: WA.player.name || "You",
        onNow: hidden ? "" : (st.onNow || ""),
        scene: hidden ? "" : (st.scene || ""),
        closeLine: st.closedDay === todayKey() ? (st.closeLine || "") : "",
        hidden: hidden
    };
}

function roster() {
    var rows = [selfCard()];
    safe(function () {
        WA.players.list().forEach(function (p) {
            var hidden = p.state.hidden === true || p.state.hidden === "true";
            rows.push({
                name: p.name || "Someone",
                onNow: hidden ? "" : (p.state.onNow || ""),
                scene: hidden ? "" : (p.state.scene || ""),
                closeLine: p.state.closeLine || "",
                hidden: hidden
            });
        });
    });
    return rows;
}

var GLYPH = { deep: "◇", fire: "△", calm: "○", build: "□" };

function rosterHtml() {
    var rows = roster().map(function (r) {
        var glyph = r.scene && GLYPH[r.scene] ? GLYPH[r.scene] + " " : "";
        var line = r.closeLine
            ? '<em style="color:#e2b25c">closed · ' + esc(r.closeLine) + "</em>"
            : r.onNow
                ? esc(r.onNow)
                : '<em style="color:#8b95a8">no card yet</em>';
        return '<li><strong>' + glyph + esc(r.name) + "</strong><br>" + line + "</li>";
    });
    var log = readRoom("gateA");
    var today = todayKey();
    var both = log.filter(function (r) {
        return r.day === today && r.arrived && r.closed;
    }).length;
    return (
        '<h1 style="font-size:16px;margin:0 0 10px">On the floor</h1>' +
        '<ul style="list-style:none;padding:0;margin:0;display:grid;gap:10px">' +
        rows.join("") +
        "</ul>" +
        '<p style="color:#8b95a8;font-size:12px;margin-top:14px">' +
        "Today: " + both + " closed the day. Presence is not productivity.</p>"
    );
}

function esc(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/* ---------- action bindings ---------- */

function bindAction(areaName, message, open) {
    var action;
    safe(function () {
        WA.room.area.onEnter(areaName).subscribe(function () {
            if (action && action.remove) action.remove();
            action = WA.ui.displayActionMessage({ message: message, callback: open });
        });
        WA.room.area.onLeave(areaName).subscribe(function () {
            if (action && action.remove) action.remove();
            action = undefined;
        });
    });
}

function openModal(title, src) {
    safe(function () {
        WA.ui.modal.openModal({
            title: title,
            src: src,
            allowApi: true,
            position: "center",
            allow: "fullscreen"
        });
    });
}

WA.onInit().then(function () {
    /* Without tracking, everyone else's card is invisible — the v1 bug. */
    safe(function () {
        WA.players.configureTracking({ players: true, movement: false });
    });

    DESKS.forEach(function (areaName) {
        bindAction(areaName, "SPACE — sit down (scene + on now)", function () {
            openModal("Sit down", "./sit.html");
        });
    });

    bindAction("door", "SPACE — close the day", function () {
        openModal("Door", "./door.html");
    });

    ["board-l", "board-r"].forEach(function (areaName) {
        bindAction(areaName, "SPACE — who is on the floor", function () {
            openModal("On the floor", "./roster.html");
        });
    });

    ["cafe", "meeting"].forEach(function (areaName) {
        safe(function () {
            WA.room.area.onEnter(areaName).subscribe(function () {
                WA.ui.displayActionMessage({
                    message: areaName === "cafe"
                        ? "Café — walk up to talk (camera opens when you are close)"
                        : "Meeting — SPACE for a room with screen share",
                    callback: function () {}
                });
            });
        });
    });

    /* A card someone else typed should land on your screen without you
       walking over to read it. */
    safe(function () {
        WA.players.onPlayerEnters.subscribe(function (p) {
            say(p.name + " is on the floor");
        });
        WA.players.onPlayerLeaves.subscribe(function (p) {
            say(p.name + " left the floor");
        });
        WA.players.onVariableChange.subscribe(function (evt) {
            var who = evt.player && evt.player.name ? evt.player.name : "Someone";
            if (evt.key === "onNow" && evt.value) say(who + " · on now: " + evt.value);
            if (evt.key === "closeLine" && evt.value) say(who + " closed · " + evt.value);
        });
    });

    WA.ui.onModalClose(function () {
        var st = WA.player.state;
        var hidden = st.hidden === true || st.hidden === "true";
        var today = todayKey();
        /* Hide wins over anything typed earlier in the session. */
        safe(function () {
            st.saveVariable("onNow", hidden ? "" : (st.onNow || ""), { public: true, persist: true });
            st.saveVariable("scene", hidden ? "" : (st.scene || ""), { public: true, persist: true });
        });
        var arrived = st.arrivedDay === today;
        var closed = st.closedDay === today;
        if (arrived || closed) {
            recordGateA({
                day: today,
                name: WA.player.name || "Unnamed",
                arrived: arrived,
                closed: closed,
                closeLine: closed ? (st.closeLine || "") : ""
            });
        }
    });

    say("FD Office — walk to a desk, SPACE to sit. Board shows who is here.");

    safe(function () {
        if (!WA.player.state.seenHowTo) {
            openModal("How the floor works", "./how-to.html");
        }
    });
}).catch(function (err) {
    console.error("FD Office map script failed to init", err);
});
