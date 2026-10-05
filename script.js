/// <reference types="@workadventure/iframe-api-typings" />
/**
 * FD Office Stage 0 — WorkAdventure map script.
 * SPACE to sit / close / pin / look out. Do not auto-open a modal on walk-through.
 * Charter: nothing above your head you did not type. Hide clears public state.
 *
 * 357 (2026-10-05): board notes are written (CD3), café napkins + say (CD5),
 * sill view seeded by the day (CD7). Gate A scoring lives in loop.js so the
 * rehearsal and this map cannot disagree. Every WA call is wrapped.
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

function parseJsonSafe(raw, fallback) {
    if (raw == null || raw === "") return fallback;
    if (typeof raw !== "string") return raw;
    try {
        return JSON.parse(raw);
    } catch (err) {
        return fallback;
    }
}

/* ---------- shared Gate A log (room variable, declared in office.tmj) ---------- */

function readRoom(key) {
    return safe(function () {
        return parseJsonSafe(WA.state.loadVariable(key), []);
    }, []);
}

function writeRoom(key, value) {
    return safe(function () {
        WA.state.saveVariable(key, typeof value === "string" ? value : JSON.stringify(value));
        return true;
    }, false);
}

function recordGateA(entry) {
    var log = readRoom("gateA");
    if (!Array.isArray(log)) log = [];
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
        safe(function () {
            WA.player.state.saveVariable("gateAFallback", JSON.stringify(log), {
                public: false,
                persist: true
            });
        });
    }
    return ok;
}

function recordOpener(name) {
    var today = todayKey();
    var current = safe(function () {
        return parseJsonSafe(WA.state.loadVariable("opener"), {});
    }, {});
    if (current && current.day === today && current.name) return current;
    var next = { day: today, name: name || "" };
    writeRoom("opener", next);
    return next;
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
        return "<li><strong>" + glyph + esc(r.name) + "</strong><br>" + line + "</li>";
    });
    var log = readRoom("gateA");
    var today = todayKey();
    var both = (Array.isArray(log) ? log : []).filter(function (r) {
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

function setZoneFlag(key, on) {
    safe(function () {
        WA.player.state.saveVariable(key, !!on, { public: true, persist: false });
    });
}

function othersIn(flag) {
    var n = 0;
    safe(function () {
        WA.players.list().forEach(function (p) {
            if (p.state[flag] === true || p.state[flag] === "true") n += 1;
        });
    });
    return n;
}

function occupantOf(areaName) {
    var found = null;
    safe(function () {
        WA.players.list().forEach(function (p) {
            var left = p.state.left === true || p.state.left === "true";
            if (!left && p.state.claimedDesk === areaName) found = p;
        });
    });
    return found;
}

function bindDesk(areaName) {
    var action;
    safe(function () {
        WA.room.area.onEnter(areaName).subscribe(function () {
            if (action && action.remove) action.remove();
            var occ = occupantOf(areaName);
            var msg = occ
                ? "SPACE — leave a note for " + (occ.name || "them")
                : "SPACE — sit down (write what you are on)";
            action = WA.ui.displayActionMessage({
                message: msg,
                callback: function () {
                    var who = occupantOf(areaName);
                    safe(function () {
                        WA.player.state.saveVariable("pendingDesk", areaName, { public: false, persist: false });
                    });
                    if (who) {
                        safe(function () {
                            WA.player.state.saveVariable("noteFor", who.name || "", { public: false, persist: false });
                        });
                        openModal("A note for " + (who.name || "them"), "./board.html");
                    } else {
                        openModal("Sit down", "./sit.html");
                    }
                }
            });
        });
        WA.room.area.onLeave(areaName).subscribe(function () {
            if (action && action.remove) action.remove();
            action = undefined;
        });
    });
}

WA.onInit().then(function () {
    safe(function () {
        WA.players.configureTracking({ players: true, movement: false });
    });

    DESKS.forEach(bindDesk);

    bindAction("door", "SPACE — close the day", function () {
        openModal("Door", "./door.html");
    });

    bindAction("board-l", "SPACE — leave a note", function () {
        openModal("Board", "./board.html");
    });
    bindAction("board-r", "SPACE — who is on the floor", function () {
        openModal("On the floor", "./roster.html");
    });
    bindAction("sill", "SPACE — look out", function () {
        openModal("Look out", "./sill.html");
    });

    var cafeAction;
    safe(function () {
        WA.room.area.onEnter("cafe").subscribe(function () {
            setZoneFlag("inCafe", true);
            var withYou = othersIn("inCafe");
            if (cafeAction && cafeAction.remove) cafeAction.remove();
            cafeAction = WA.ui.displayActionMessage({
                message: withYou
                    ? "Café — you are here with others. SPACE leaves a napkin"
                    : "Café — walk up to talk. SPACE leaves a napkin",
                callback: function () { openModal("Café", "./cafe.html"); }
            });
        });
        WA.room.area.onLeave("cafe").subscribe(function () {
            setZoneFlag("inCafe", false);
            if (cafeAction && cafeAction.remove) cafeAction.remove();
            cafeAction = undefined;
        });
    });

    safe(function () {
        WA.room.area.onEnter("meeting").subscribe(function () {
            setZoneFlag("inMeeting", true);
        });
        WA.room.area.onLeave("meeting").subscribe(function () {
            setZoneFlag("inMeeting", false);
        });
    });

    safe(function () {
        WA.ui.registerMenuCommand("Say something", {
            callback: function () { openModal("Say something", "./say.html"); }
        });
        WA.ui.registerMenuCommand("Today's agenda", {
            callback: function () { openModal("Today's agenda", "./meeting.html"); }
        });
    });

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
            if (evt.key === "say" && evt.value) say(who + ": " + evt.value);
            if (evt.key === "inCafe" && (evt.value === true || evt.value === "true")) {
                say(who + " is in the café");
            }
        });
    });

    WA.ui.onModalClose(function () {
        var st = WA.player.state;
        var hidden = st.hidden === true || st.hidden === "true";
        var today = todayKey();
        safe(function () {
            st.saveVariable("onNow", hidden ? "" : (st.onNow || ""), { public: true, persist: true });
            st.saveVariable("scene", hidden ? "" : (st.scene || ""), { public: true, persist: true });
            st.saveVariable("next", hidden ? "" : (st.next || ""), { public: true, persist: true });
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
        if (arrived) {
            var opened = recordOpener(WA.player.name || "");
            if (opened && opened.name === (WA.player.name || "") && st.heardOpenerDay !== today) {
                say(opened.name + " opened the office");
                safe(function () {
                    st.saveVariable("heardOpenerDay", today, { public: false, persist: true });
                });
            }
        }
    });

    say("FD Office — walk to a desk, SPACE to sit. The sill looks out. Left board is notes.");

    safe(function () {
        if (!WA.player.state.seenHowTo) {
            openModal("How the floor works", "./how-to.html");
        }
    });
}).catch(function (err) {
    console.error("FD Office map script failed to init", err);
});
