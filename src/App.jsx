import React, { useState, useEffect, useMemo, useCallback, useRef, useContext } from "react";
import { Plus, X, ChevronLeft, ChevronRight, ChevronDown, Users, CalendarDays, Moon, Sun, Printer, FileSpreadsheet, History, RotateCcw, LogOut } from "lucide-react";
import { auth, db, subscribeToChanges } from "./storage";
import Login from "./Login";
import { SPECIAL_DAYS } from "./holidays";
import { exportMonthXlsx, printMonth } from "./exporters";

// -- Σχολικό έτος: Σεπτέμβριος 2026 → Ιούνιος 2027 --
const MONTHS = [
  { y: 2026, m: 9, label: "Σεπτέμβριος", dark: "#3B2E05", darkSoft: "#55420B", accent: "#F5B700", light: "#FFF3D0" },
  { y: 2026, m: 10, label: "Οκτώβριος", dark: "#10233F", darkSoft: "#1B3A63", accent: "#2E86DE", light: "#DCEBFB" },
  { y: 2026, m: 11, label: "Νοέμβριος", dark: "#1F2B12", darkSoft: "#33461E", accent: "#6FA83C", light: "#E6F0D8" },
  { y: 2026, m: 12, label: "Δεκέμβριος", dark: "#3B0F17", darkSoft: "#5C1D28", accent: "#E1483A", light: "#FBDEDA" },
  { y: 2027, m: 1, label: "Ιανουάριος", dark: "#16193B", darkSoft: "#232A5C", accent: "#4C63C9", light: "#E2E5FB" },
  { y: 2027, m: 2, label: "Φεβρουάριος", dark: "#2E1233", darkSoft: "#4A1F52", accent: "#A64CC9", light: "#F2DFF7" },
  { y: 2027, m: 3, label: "Μάρτιος", dark: "#0F2E2A", darkSoft: "#1C4A43", accent: "#17A589", light: "#D6F3EC" },
  { y: 2027, m: 4, label: "Απρίλιος", dark: "#16250C", darkSoft: "#2C4419", accent: "#5EBB2D", light: "#E1F5CF" },
  { y: 2027, m: 5, label: "Μάιος", dark: "#3A2408", darkSoft: "#5C3B12", accent: "#F08A24", light: "#FDE6C7" },
  { y: 2027, m: 6, label: "Ιούνιος", dark: "#2E2A08", darkSoft: "#4A4310", accent: "#F0C419", light: "#FCF3C4" },
];

const DAY_LABELS = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"];

const DRIVER_COLORS = [
  { bg: "#FFF4D6", ink: "#8A5A00", dash: "#F2B705" },
  { bg: "#E3F0EF", ink: "#1E5C58", dash: "#3E7C8C" },
  { bg: "#F3E6F3", ink: "#6A3D6A", dash: "#A466A4" },
  { bg: "#E8EEE0", ink: "#4B6A2E", dash: "#7FA352" },
  { bg: "#FCE4E0", ink: "#9C3B2E", dash: "#D9695A" },
  { bg: "#E4E9F7", ink: "#334A8A", dash: "#6E85C7" },
  { bg: "#FDEFD8", ink: "#8A5F1E", dash: "#D99A3F" },
  { bg: "#E0F2F7", ink: "#17607A", dash: "#3FA7C6" },
  { bg: "#F7E1EA", ink: "#8A2F55", dash: "#D4668E" },
  { bg: "#EAEAD0", ink: "#5E5E1C", dash: "#A9A93F" },
  { bg: "#E5E0F5", ink: "#4A3A8A", dash: "#8D7BD1" },
  { bg: "#DDF2E4", ink: "#1F6A3A", dash: "#4DB578" },
];

// Χρώματα διεπαφής για φωτεινό / σκούρο θέμα (οι κάρτες και τα πεδία· το φόντο έχει δικό του θέμα ανά μήνα)
const UI_LIGHT = {
  card: "#FFFFFF", cardBorder: "rgba(35,38,43,0.08)", cardShadow: "0 4px 16px rgba(35,38,43,0.12)",
  ink: "#23262B", ink2: "#4A4D54", muted: "#8A8D95", faint: "#C7C3B5", hint: "#B7B2A0",
  pop: "#FFFDF8", popBorder: "#EDE8D9", field: "#FFFFFF", fieldBorder: "#E6E2D4",
  chip: "#F3F1EA", chipInk: "#5B5748", chipOff: "#F7F6F1", chipOffInk: "#C7C3B5",
  panel: "#F9F8F4", panelBorder: "#EFEDE6", rule: "#EFEDE6", cellShadow: "0 2px 8px rgba(35,38,43,0.10)",
};
const UI_DARK = {
  card: "#1F2331", cardBorder: "rgba(255,255,255,0.08)", cardShadow: "0 4px 16px rgba(0,0,0,0.35)",
  ink: "#ECEDF0", ink2: "#C5C8D0", muted: "#9AA0AE", faint: "#5A6072", hint: "#7A8092",
  pop: "#272C3D", popBorder: "#3A4156", field: "#1A1E2B", fieldBorder: "#3A4156",
  chip: "#2D3347", chipInk: "#C9CCD8", chipOff: "#232837", chipOffInk: "#5A6072",
  panel: "#232838", panelBorder: "#2F3548", rule: "#2F3548", cellShadow: "0 2px 8px rgba(0,0,0,0.35)",
};
const UIContext = React.createContext(UI_LIGHT);

const COL_WIDTH = 122;

function pad(n) {
  return String(n).padStart(2, "0");
}
function dateKey(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}
function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}
function mondayIndex(y, m, d) {
  const js = new Date(y, m - 1, d).getDay();
  return (js + 6) % 7;
}
function fmtDate(key) {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}
function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleString("el-GR", { timeZone: "Europe/Athens", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return iso;
  }
}
function fmtNum(n) {
  return n.toLocaleString("el-GR", { maximumFractionDigits: 1 });
}
function lsGet(k) {
  try {
    return window.localStorage.getItem(k);
  } catch (e) {
    return null;
  }
}
function lsSet(k, v) {
  try {
    window.localStorage.setItem(k, v);
  } catch (e) {
    /* ignore */
  }
}
function normalizeName(s) {
  return s
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0f\u20e3]/gu, "") // τα emoji δεν μετράνε στη σύγκριση
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}
// Από δύο γραφές του ίδιου ονόματος κρατάμε τη μακρύτερη (αυτή με τα emoji).
function preferName(map, nk, name) {
  if (!map[nk] || name.trim().length > map[nk].trim().length) map[nk] = name;
}
function splitNames(raw) {
  return raw
    .split(/[,，、/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
function colorFor(canonicalName, palette) {
  if (!palette[canonicalName]) {
    const used = Object.keys(palette).length;
    palette[canonicalName] = DRIVER_COLORS[used % DRIVER_COLORS.length];
  }
  return palette[canonicalName];
}
function expandEntries(raw) {
  const out = [];
  raw.forEach((e) => {
    const parts = splitNames(e.driver);
    if (parts.length <= 1) {
      out.push(e);
    } else {
      parts.forEach((p, i) => {
        out.push({ ...e, id: `${e.id}__${i}`, driver: p, ts: e.ts + i * 0.001, originalId: e.id });
      });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// DayPopover — προσαρτημένο ΑΚΡΙΒΩΣ στο κελί (position: absolute σχετικά με
// το κελί, ΟΧΙ fixed/viewport). Τοπικό state ώστε η πληκτρολόγηση να μην
// αγγίζει το ημερολόγιο.
// ---------------------------------------------------------------------------
function DayPopover({ dKey, theme, dayEntries, canonicalOf, numbered, palette, knownDrivers, onAdd, onRemove, onClose, alignRight }) {
  const ui = useContext(UIContext);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const names = splitNames(draft);
    if (names.length === 0) return;
    onAdd(dKey, names);
    setDraft("");
    inputRef.current?.focus();
  };

  // Ονόματα που υπάρχουν ήδη σήμερα — για να ξεθωριάσουμε τα quick-add chips τους
  const todayNorm = new Set(dayEntries.map((e) => normalizeName(canonicalOf(e.driver))));

  return (
    <div
      onClick={(ev) => ev.stopPropagation()}
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        [alignRight ? "right" : "left"]: 0,
        width: 250,
        zIndex: 30,
        background: ui.pop,
        borderRadius: 14,
        padding: "14px 14px 12px",
        boxShadow: "0 14px 34px rgba(0,0,0,0.28)",
        border: `1px solid ${ui.popBorder}`,
        cursor: "default",
        color: ui.ink,
      }}
    >
      <button
        onClick={onClose}
        aria-label="Κλείσιμο"
        style={{
          position: "absolute",
          top: -12,
          right: -12,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#E1483A",
          color: "#FFFFFF",
          border: `2px solid ${ui.pop}`,
          boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 31,
        }}
      >
        <X size={18} strokeWidth={2.6} />
      </button>

      {dayEntries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {dayEntries.map((e) => {
            const canon = canonicalOf(e.driver);
            const c = colorFor(canon, palette);
            return (
              <div
                key={e.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: c.bg, color: c.ink, borderRadius: 9, padding: "7px 8px 7px 11px", border: `1px solid ${c.dash}55` }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>{canon} {numbered[e.id]}</span>
                <button
                  onClick={() => onRemove(e.id, e.originalId)}
                  style={{ background: "rgba(255,255,255,0.6)", border: "none", borderRadius: 7, cursor: "pointer", color: c.ink, display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26 }}
                  title="Διαγραφή (μπορείς να την αναιρέσεις)"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <input
          ref={inputRef}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") submit();
          }}
          placeholder="Όνομα οδηγού"
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
            border: `1.5px solid ${ui.fieldBorder}`,
            background: ui.field,
            color: ui.ink,
            borderRadius: 8,
            padding: "8px 9px",
            fontSize: 13.5,
          }}
        />
        <button
          onClick={submit}
          style={{ background: theme.accent, color: "#FFFFFF", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
        >
          +
        </button>
      </div>
      <div style={{ fontSize: 10, color: ui.hint, marginTop: 5 }}>Πολλά ονόματα; Χώρισέ τα με κόμμα.</div>

      {knownDrivers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>
          {knownDrivers.map((dr) => {
            const already = todayNorm.has(normalizeName(dr));
            return (
              <button
                key={dr}
                disabled={already}
                onClick={() => onAdd(dKey, [dr])}
                title={already ? "Έχει ήδη καταχωρηθεί σήμερα" : undefined}
                style={{
                  background: already ? ui.chipOff : ui.chip,
                  color: already ? ui.chipOffInk : ui.chipInk,
                  border: `1px solid ${ui.fieldBorder}`,
                  borderRadius: 20,
                  padding: "3px 9px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: already ? "default" : "pointer",
                }}
              >
                {already ? "✓" : "+"} {dr}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DayCell — memoized. Το popover ζει ΜΕΣΑ σε αυτό (position: relative στο κελί).
// ---------------------------------------------------------------------------
const DayCell = React.memo(function DayCell({ d, dKey, isToday, isSelected, isWeekend, special, alignRight, dayEntries, theme, canonicalOf, numbered, palette, knownDrivers, onOpen, onAdd, onRemove, onClose }) {
  const ui = useContext(UIContext);
  const closed = special && special.type === "closed";
  return (
    <div style={{ position: "relative" }} id={`day-${dKey}`}>
      <div
        className="daycell"
        onClick={() => onOpen(dKey)}
        style={{
          minHeight: 128,
          borderRadius: 13,
          border: isSelected ? `2px solid ${theme.accent}` : isToday ? `2px solid ${theme.accent}` : `1px solid ${ui.cardBorder}`,
          background: closed ? `repeating-linear-gradient(135deg, ${ui.card} 0 9px, ${ui.panel} 9px 18px)` : ui.card,
          boxShadow: isSelected ? `0 0 0 3px ${theme.accent}77` : isToday ? `0 0 0 4px ${theme.accent}66, 0 6px 16px rgba(0,0,0,0.18)` : ui.cellShadow,
          padding: "8px 7px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 1px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: isToday ? 800 : 600,
                color: isToday ? "#FFFFFF" : ui.ink2,
                background: isToday ? theme.accent : "transparent",
                borderRadius: 20,
                minWidth: 22,
                height: 22,
                lineHeight: "22px",
                textAlign: "center",
                padding: isToday ? "0 4px" : 0,
              }}
            >
              {d}
            </span>
            {isToday && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: theme.accent }}>ΣΗΜΕΡΑ</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {isWeekend && <span style={{ width: 5, height: 5, borderRadius: 5, background: theme.accent }} title="Σαββατοκύριακο" />}
            <Plus size={13} strokeWidth={2.5} color={ui.faint} />
          </div>
        </div>

        {special && (
          <div
            style={{
              alignSelf: "flex-start",
              fontSize: 9.5,
              fontWeight: 700,
              borderRadius: 6,
              padding: "1px 6px",
              background: closed ? "#E1483A22" : `${theme.accent}33`,
              color: closed ? "#C0392B" : ui.ink2,
            }}
          >
            {closed ? "🚫 " : "🎼 "}
            {special.label}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {dayEntries.map((e) => {
            const canon = canonicalOf(e.driver);
            const c = colorFor(canon, palette);
            return (
              <div
                key={e.id}
                style={{
                  background: c.bg,
                  color: c.ink,
                  borderRadius: 20,
                  padding: "3.5px 9px",
                  fontSize: 11.5,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  border: `1px solid ${c.dash}55`,
                }}
              >
                {canon} {numbered[e.id]}
              </div>
            );
          })}
        </div>
      </div>

      {isSelected && (
        <DayPopover
          dKey={dKey}
          theme={theme}
          dayEntries={dayEntries}
          canonicalOf={canonicalOf}
          numbered={numbered}
          palette={palette}
          knownDrivers={knownDrivers}
          onAdd={onAdd}
          onRemove={onRemove}
          onClose={onClose}
          alignRight={alignRight}
        />
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// OffsetForm — αρχικός αριθμός δρομολογίων για νέο (ή υπάρχοντα) οδηγό
// ---------------------------------------------------------------------------
function OffsetForm({ knownDrivers, driverOffsets, onSave, theme }) {
  const ui = useContext(UIContext);
  const [name, setName] = useState("");
  const [offset, setOffset] = useState("");
  const [saved, setSaved] = useState("");

  const save = () => {
    const n = name.trim();
    const num = parseInt(offset, 10);
    if (!n || Number.isNaN(num) || num < 0) return;
    onSave(n, num);
    setSaved(n);
    setName("");
    setOffset("");
    setTimeout(() => setSaved(""), 2000);
  };
  const inputStyle = { boxSizing: "border-box", border: `1.5px solid ${ui.fieldBorder}`, background: ui.field, color: ui.ink, borderRadius: 8, padding: "8px 9px", fontSize: 13.5 };

  return (
    <div style={{ marginTop: 10, background: ui.panel, border: `1px solid ${ui.panelBorder}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11.5, color: ui.muted, marginBottom: 8 }}>
        Πες μας το όνομα και τον αριθμό δρομολογίου από τον οποίο να ξεκινήσει να μετράει. π.χ. αν κλείσαμε τον μήνα στο 5, βάλε 5 — το επόμενο δρομολόγιό του θα φανεί ως 6.
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Όνομα οδηγού" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
        <input type="number" min="0" value={offset} onChange={(ev) => setOffset(ev.target.value)} placeholder="Αριθμός" style={{ ...inputStyle, width: 78 }} />
      </div>
      {knownDrivers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {knownDrivers.map((dr) => (
            <button key={dr} onClick={() => setName(dr)} style={{ background: ui.chip, color: ui.chipInk, border: `1px solid ${ui.fieldBorder}`, borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              {dr}
            </button>
          ))}
        </div>
      )}
      <button onClick={save} style={{ width: "100%", background: theme.accent, color: "#FFFFFF", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        Αποθήκευση
      </button>
      {saved && <div style={{ fontSize: 11.5, color: "#4B6A2E", marginTop: 6 }}>Ρυθμίστηκε ο αρχικός αριθμός για {saved} ✓</div>}

      {Object.values(driverOffsets).length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {Object.values(driverOffsets).map((info) => (
            <div key={info.name} style={{ fontSize: 11.5, color: ui.muted }}>
              {info.name} — αρχικός αριθμός: {info.offset}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Πτυσσόμενη κάρτα (για πιο καθαρή σελίδα κάτω από το ημερολόγιο)
function Card({ icon, title, open, onToggle, children }) {
  const ui = useContext(UIContext);
  return (
    <div style={{ margin: "14px 14px 0", background: ui.card, border: `1px solid ${ui.cardBorder}`, boxShadow: ui.cardShadow, borderRadius: 14, padding: "12px 16px", color: ui.ink }}>
      <button onClick={onToggle} style={{ width: "100%", background: "none", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 7, cursor: "pointer", color: ui.muted }}>
        {icon}
        <span className="sg" style={{ fontSize: 12.5, fontWeight: 600, color: ui.muted, flex: 1, textAlign: "left" }}>{title}</span>
        <ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

// Το κλειδί ομάδας έρχεται μέσα στο λινκ (…/#k=ΚΛΕΙΔΙ). Το διαβάζουμε μία φορά και
// αμέσως το σβήνουμε από τη γραμμή διευθύνσεων.
const LINK_KEY = (() => {
  try {
    const k = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("k");
    if (k) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return k || "";
  } catch (e) {
    return "";
  }
})();

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function todayStamp() {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function Calendar({ actor, onSignOut, onRename }) {
  const [allEntries, setAllEntries] = useState([]); // περιλαμβάνει και τα διαγραμμένα (κάδος)
  const [driverOffsets, setDriverOffsets] = useState({}); // normalizedName -> { name, offset }
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState(null); // { msg, undoId }
  const [dark, setDark] = useState(() => lsGet("dk-dark") === "1");
  const [open, setOpen] = useState({ month: true, year: true, history: false, data: false });
  const [history, setHistory] = useState([]);
  const [backups, setBackups] = useState(null);
  const [installEvt, setInstallEvt] = useState(null);
  const [monthIdx, setMonthIdx] = useState(() => {
    // Ανοίγει πάντα στον τρέχοντα μήνα (αν είναι εκτός σχολικού έτους, στον κοντινότερο)
    const now = new Date();
    const i = MONTHS.findIndex((mo) => mo.y === now.getFullYear() && mo.m === now.getMonth() + 1);
    return i !== -1 ? i : now < new Date(2026, 8, 1) ? 0 : MONTHS.length - 1;
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [offsetPanelOpen, setOffsetPanelOpen] = useState(false);
  const weekdayInnerRef = useRef(null);
  const weekdayFixedInnerRef = useRef(null);
  const weekdayPlaceholderRef = useRef(null);
  const gridScrollRef = useRef(null);
  const [fixedHeaderVisible, setFixedHeaderVisible] = useState(false);

  const entriesRef = useRef([]);
  const offsetsRef = useRef({});
  const historyOpenRef = useRef(false);
  const toastTimer = useRef(null);
  const backupDone = useRef(false);
  const swipe = useRef(null);
  entriesRef.current = allEntries;
  offsetsRef.current = driverOffsets;
  historyOpenRef.current = open.history;

  const ui = dark ? UI_DARK : UI_LIGHT;

  const showToast = useCallback((msg, undoId) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, undoId });
    toastTimer.current = setTimeout(() => setToast(null), undoId ? 9000 : 4500);
  }, []);

  const toggleDark = () => {
    setDark((v) => {
      lsSet("dk-dark", v ? "0" : "1");
      return !v;
    });
  };

  const syncWeekdayHeader = useCallback(() => {
    if (gridScrollRef.current) {
      const x = gridScrollRef.current.scrollLeft;
      if (weekdayInnerRef.current) weekdayInnerRef.current.style.transform = `translateX(-${x}px)`;
      if (weekdayFixedInnerRef.current) weekdayFixedInnerRef.current.style.transform = `translateX(-${x}px)`;
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!weekdayPlaceholderRef.current) return;
      const rect = weekdayPlaceholderRef.current.getBoundingClientRect();
      setFixedHeaderVisible(rect.top <= 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (fixedHeaderVisible) syncWeekdayHeader();
  }, [fixedHeaderVisible, syncWeekdayHeader]);

  const openDay = useCallback((dKey) => {
    setSelectedDay((prev) => (prev === dKey ? null : dKey));
  }, []);
  const closeAll = useCallback(() => setSelectedDay(null), []);

  // ---- Φόρτωση ----
  const reloadTrips = useCallback(async () => {
    try {
      const list = await db.loadTrips();
      setAllEntries(list);
      setLoadError("");
      return list;
    } catch (e) {
      console.error(e);
      setLoadError("Δεν φορτώθηκαν τα δεδομένα. Έλεγξε τη σύνδεσή σου στο internet.");
      return null;
    }
  }, []);
  const reloadOffsets = useCallback(async () => {
    try {
      const o = await db.loadOffsets();
      setDriverOffsets(o);
      return o;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, []);
  const reloadHistory = useCallback(async () => {
    try {
      setHistory(await db.loadHistory(80));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [list, offs] = await Promise.all([reloadTrips(), reloadOffsets()]);
      setLoaded(true);
      // Ένα αυτόματο αντίγραφο ασφαλείας ανά μέρα (το φτιάχνει όποιος ανοίξει πρώτος)
      if (list && offs && !backupDone.current) {
        backupDone.current = true;
        db.saveDailyBackup({
          app: "dromologia-katerinis",
          exportedAt: new Date().toISOString(),
          entries: list.filter((e) => !e.deletedAt).map(({ id, date, driver, ts }) => ({ id, date, driver, ts })),
          driverOffsets: offs,
        });
      }
    })();
  }, [reloadTrips, reloadOffsets]);

  // Real-time: όταν ένας συνάδελφος καταχωρήσει κάτι, ενημερώνεται αυτόματα και η δική σου οθόνη
  useEffect(() => {
    let timer = null;
    const pending = new Set();
    const unsubscribe = subscribeToChanges((kind) => {
      pending.add(kind);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (pending.has("trips")) reloadTrips();
        if (pending.has("offsets")) reloadOffsets();
        if (pending.has("history") && historyOpenRef.current) reloadHistory();
        pending.clear();
      }, 250);
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") reloadTrips();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reloadTrips, reloadOffsets, reloadHistory]);

  useEffect(() => {
    if (open.history) reloadHistory();
  }, [open.history, reloadHistory]);

  useEffect(() => {
    const onPrompt = (ev) => {
      ev.preventDefault();
      setInstallEvt(ev);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // ---- Αλλαγές δεδομένων ----
  const failed = useCallback(
    (e) => {
      console.error(e);
      showToast("⚠️ Η αποθήκευση απέτυχε — ξαναδοκίμασε (έλεγξε τη σύνδεση).");
      reloadTrips();
    },
    [showToast, reloadTrips]
  );

  const setDriverOffset = useCallback(
    (name, offset) => {
      const nk = normalizeName(name);
      if (!nk) return;
      const next = { ...offsetsRef.current, [nk]: { name: name.trim(), offset } };
      setDriverOffsets(next);
      db.saveOffsets(next)
        .then(() => db.log({ action: "offset", driver: name.trim(), detail: `αρχικός αριθμός ${offset}` }, actor))
        .catch(failed);
    },
    [actor, failed]
  );

  const addEntry = useCallback(
    (dKey, names) => {
      const base = Date.now();
      const active = entriesRef.current.filter((e) => !e.deletedAt);
      // Ονόματα που υπάρχουν ήδη αυτή τη μέρα (κανονικοποιημένα) — αποτροπή διπλοκαταχώρησης
      const existingNorm = new Set(
        expandEntries(active)
          .filter((e) => e.date === dKey)
          .map((e) => normalizeName(e.driver))
      );
      const seen = new Set();
      const toAdd = [];
      names.forEach((name) => {
        const nk = normalizeName(name);
        if (!nk || existingNorm.has(nk) || seen.has(nk)) return;
        seen.add(nk);
        toAdd.push(name);
      });
      if (toAdd.length === 0) return;
      const rows = toAdd.map((name, i) => ({
        id: `${base}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        date: dKey,
        driver: name,
        ts: base + i,
        createdBy: actor,
        deletedAt: null,
        deletedBy: "",
      }));
      entriesRef.current = [...entriesRef.current, ...rows];
      setAllEntries(entriesRef.current);
      db.insertTrips(rows, actor)
        .then(() => db.log(rows.map((r) => ({ action: "add", trip_id: r.id, date: r.date, driver: r.driver })), actor))
        .catch(failed);
    },
    [actor, failed]
  );

  const removeEntry = useCallback(
    (id, originalId) => {
      const targetId = originalId || id;
      const target = entriesRef.current.find((e) => e.id === targetId);
      if (!target) return;
      const now = new Date().toISOString();
      entriesRef.current = entriesRef.current.map((e) => (e.id === targetId ? { ...e, deletedAt: now, deletedBy: actor } : e));
      setAllEntries(entriesRef.current);
      db.softDelete(targetId, actor)
        .then(() => db.log({ action: "remove", trip_id: targetId, date: target.date, driver: target.driver }, actor))
        .catch(failed);
      showToast(`Διαγράφηκε: ${target.driver} (${fmtDate(target.date)})`, targetId);
    },
    [actor, failed, showToast]
  );

  const restoreEntry = useCallback(
    (id) => {
      const target = entriesRef.current.find((e) => e.id === id);
      if (!target) return;
      entriesRef.current = entriesRef.current.map((e) => (e.id === id ? { ...e, deletedAt: null, deletedBy: "" } : e));
      setAllEntries(entriesRef.current);
      setToast(null);
      db.restore(id)
        .then(() => db.log({ action: "restore", trip_id: id, date: target.date, driver: target.driver }, actor))
        .then(() => (historyOpenRef.current ? reloadHistory() : null))
        .catch(failed);
    },
    [actor, failed, reloadHistory]
  );

  const entries = useMemo(() => allEntries.filter((e) => !e.deletedAt), [allEntries]);

  // --- Εξαγωγή / Εισαγωγή δεδομένων ---
  const fileInputRef = useRef(null);

  const buildPayload = () => ({
    app: "dromologia-katerinis",
    exportedAt: new Date().toISOString(),
    entries: entries.map(({ id, date, driver, ts }) => ({ id, date, driver, ts })),
    driverOffsets,
  });

  const exportJSON = () => {
    downloadFile(`dromologia-antigrafo-${todayStamp()}.json`, JSON.stringify(buildPayload(), null, 2), "application/json");
  };

  const csvEscape = (v) => `"${String(v).replace(/"/g, '""')}"`;

  const exportCSV = () => {
    const expanded = expandEntries(entries);
    const canonicalMap = {};
    [...expanded].sort((a, b) => a.ts - b.ts).forEach((e) => {
      const nk = normalizeName(e.driver);
      preferName(canonicalMap, nk, e.driver);
    });
    const counters = {};
    Object.values(driverOffsets).forEach((info) => {
      const nk = normalizeName(info.name);
      preferName(canonicalMap, nk, info.name);
    });
    const rows = [["Ημερομηνία", "Οδηγός", "Αρ. Δρομολογίου"]];
    [...expanded]
      .sort((a, b) => (a.date === b.date ? a.ts - b.ts : a.date.localeCompare(b.date)))
      .forEach((e) => {
        const canon = canonicalMap[normalizeName(e.driver)] || e.driver;
        if (counters[canon] === undefined) {
          const info = driverOffsets[normalizeName(canon)];
          counters[canon] = info ? info.offset : 0;
        }
        counters[canon] += 1;
        rows.push([e.date, canon, counters[canon]]);
      });
    const csv = "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
    downloadFile(`dromologia-${todayStamp()}.csv`, csv, "text/csv;charset=utf-8");
  };

  const handleImportFile = (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || !Array.isArray(data.entries)) throw new Error("invalid");
        const seen = new Set();
        const imported = [];
        data.entries.forEach((e) => {
          if (!e || !e.id || !e.date || !e.driver || seen.has(String(e.id))) return;
          seen.add(String(e.id));
          imported.push({ id: String(e.id), date: String(e.date), driver: String(e.driver), ts: Number(e.ts) || Date.now() });
        });
        const ok = window.confirm(
          `Η εισαγωγή θα αντικαταστήσει όλα τα τρέχοντα δρομολόγια με ${imported.length} από το αρχείο.\n\nΠρώτα θα κατεβάσω αυτόματα ένα αντίγραφο των τρεχόντων. Συνέχεια;`
        );
        if (!ok) return;
        exportJSON();
        const offs = data.driverOffsets && typeof data.driverOffsets === "object" ? data.driverOffsets : {};
        await db.replaceAll(imported, actor);
        await db.saveOffsets(offs);
        await db.log({ action: "import", detail: `${imported.length} δρομολόγια από αρχείο` }, actor);
        await reloadTrips();
        await reloadOffsets();
        showToast(`Έγινε εισαγωγή ${imported.length} δρομολογίων ✓`);
      } catch (e) {
        console.error(e);
        window.alert("Το αρχείο δεν αναγνωρίστηκε ως έγκυρο αντίγραφο δεδομένων, ή η εισαγωγή απέτυχε.");
      }
    };
    reader.readAsText(file);
  };

  const loadBackups = async () => {
    try {
      setBackups(await db.listBackups(40));
    } catch (e) {
      console.error(e);
      setBackups([]);
    }
  };

  const dataBtnStyle = { background: ui.chip, color: ui.chipInk, border: `1px solid ${ui.fieldBorder}`, borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };

  const { numbered, canonicalOf, byDate, totals, knownDrivers, palette } = useMemo(() => {
    const expanded = expandEntries(entries);
    const sorted = [...expanded].sort((a, b) => a.ts - b.ts);
    const canonicalMap = {};
    // Πρώτα "σπέρνουμε" τα ονόματα που έχουν ήδη ρυθμισμένο αρχικό αριθμό, ώστε
    // η πρώτη πραγματική καταχώρηση ενός νέου οδηγού να ταιριάξει με το σωστό όνομα.
    Object.values(driverOffsets).forEach((info) => {
      const nk = normalizeName(info.name);
      preferName(canonicalMap, nk, info.name);
    });
    sorted.forEach((e) => {
      const nk = normalizeName(e.driver);
      preferName(canonicalMap, nk, e.driver);
    });
    const canonicalOf = (raw) => canonicalMap[normalizeName(raw)] || raw;
    const offsetOf = (canonicalName) => {
      const info = driverOffsets[normalizeName(canonicalName)];
      return info ? info.offset : 0;
    };

    const counters = {};
    const numbered = {};
    const totals = {};
    const chronoByDate = [...expanded].sort((a, b) => (a.date === b.date ? a.ts - b.ts : a.date.localeCompare(b.date)));
    chronoByDate.forEach((e) => {
      const c = canonicalOf(e.driver);
      if (counters[c] === undefined) counters[c] = offsetOf(c);
      counters[c] += 1;
      numbered[e.id] = counters[c];
      totals[c] = counters[c];
    });
    // Οδηγοί με ρυθμισμένο αρχικό αριθμό αλλά καμία πραγματική καταχώρηση ακόμη
    Object.values(driverOffsets).forEach((info) => {
      if (totals[info.name] === undefined && info.offset > 0) {
        totals[info.name] = info.offset;
      }
    });

    const byDate = {};
    expanded.forEach((e) => {
      (byDate[e.date] = byDate[e.date] || []).push(e);
    });
    Object.values(byDate).forEach((arr) => arr.sort((a, b) => a.ts - b.ts));

    const knownDrivers = Object.keys(totals).sort();

    // Σταθερά χρώματα: κάθε οδηγός παίρνει χρώμα με βάση πότε πρωτοεμφανίστηκε,
    // ώστε να μην αλλάζει όταν μπαίνει νέος οδηγός.
    const palette = {};
    sorted.forEach((e) => colorFor(canonicalOf(e.driver), palette));
    Object.values(driverOffsets).forEach((info) => colorFor(canonicalOf(info.name), palette));
    knownDrivers.forEach((d) => colorFor(d, palette));

    return { numbered, canonicalOf, byDate, totals, knownDrivers, palette };
  }, [entries, driverOffsets]);

  const theme = MONTHS[monthIdx];
  const { y, m, label } = theme;

  const monthTotals = useMemo(() => {
    const prefix = `${y}-${pad(m)}`;
    const t = {};
    Object.entries(byDate).forEach(([date, list]) => {
      if (!date.startsWith(prefix)) return;
      list.forEach((e) => {
        const c = canonicalOf(e.driver);
        t[c] = (t[c] || 0) + 1;
      });
    });
    return t;
  }, [byDate, y, m, canonicalOf]);
  const monthDrivers = Object.keys(monthTotals).sort();

  // Πίνακας "ισορροπίας": σύνολο έτους κάθε οδηγού σε σχέση με τον μέσο όρο
  const balance = useMemo(() => {
    const list = knownDrivers.map((d) => totals[d] || 0);
    if (list.length === 0) return { avg: 0, max: 0, rows: [], behind: [] };
    const avg = list.reduce((a, b) => a + b, 0) / list.length;
    const max = Math.max(...list, 1);
    const rows = knownDrivers.map((d) => ({ name: d, year: totals[d] || 0, month: monthTotals[d] || 0, diff: (totals[d] || 0) - avg }));
    const behind = [...rows].filter((r) => r.diff <= -0.75).sort((a, b) => a.diff - b.diff).slice(0, 4);
    return { avg, max, rows, behind };
  }, [knownDrivers, totals, monthTotals]);

  const nDays = daysInMonth(y, m);
  const leadBlanks = mondayIndex(y, m, 1);
  const cells = [];
  for (let i = 0; i < leadBlanks; i++) cells.push(null);
  for (let d = 1; d <= nDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = (() => {
    const t = new Date();
    return dateKey(t.getFullYear(), t.getMonth() + 1, t.getDate());
  })();

  // Δεδομένα μήνα για Excel / PDF
  const monthExport = () => {
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(
        cells.slice(i, i + 7).map((d) => {
          if (d === null) return null;
          const k = dateKey(y, m, d);
          return {
            d,
            note: SPECIAL_DAYS[k] ? SPECIAL_DAYS[k].label : "",
            items: (byDate[k] || []).map((e) => `${canonicalOf(e.driver)} ${numbered[e.id]}`),
          };
        })
      );
    }
    const rows = knownDrivers.map((d) => ({ name: d, month: monthTotals[d] || 0, year: totals[d] || 0 }));
    return { label, y, m, weeks, rows };
  };

  // Κουμπί "Σήμερα"
  const scrollToToday = useCallback(
    (full) => {
      setTimeout(() => {
        const el = document.getElementById(`day-${todayKey}`);
        const box = gridScrollRef.current;
        if (!el || !box) return;
        const r = el.getBoundingClientRect();
        const cr = box.getBoundingClientRect();
        box.scrollLeft += r.left - cr.left - (cr.width - r.width) / 2;
        if (full) window.scrollTo({ top: Math.max(0, r.top + window.scrollY - 150), behavior: "smooth" });
      }, 80);
    },
    [todayKey]
  );

  const goToday = () => {
    const i = MONTHS.findIndex((mo) => mo.y === Number(todayKey.slice(0, 4)) && mo.m === Number(todayKey.slice(5, 7)));
    if (i === -1) {
      showToast("Η σημερινή μέρα είναι εκτός του σχολικού έτους 2026–2027.");
      return;
    }
    setSelectedDay(null);
    setMonthIdx(i);
    scrollToToday(true);
  };

  // Στην πρώτη φόρτωση, ο πίνακας κεντράρει οριζόντια στη σημερινή μέρα
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (!loaded || didInitialScroll.current) return;
    didInitialScroll.current = true;
    scrollToToday(false);
  }, [loaded, scrollToToday]);

  const changeMonth = (delta) => {
    setMonthIdx((i) => Math.min(MONTHS.length - 1, Math.max(0, i + delta)));
    setSelectedDay(null);
  };
  const onTouchStart = (ev) => {
    const t = ev.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (ev) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) changeMonth(dx < 0 ? 1 : -1);
  };

  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const bg = dark
    ? `linear-gradient(175deg, ${theme.dark} 0%, #12141C 38%, #0E1016 100%)`
    : `linear-gradient(175deg, ${theme.dark} 0%, ${theme.darkSoft} 16%, ${theme.accent} 46%, ${theme.light} 78%, ${theme.light} 100%)`;

  const actionLabel = (h) => {
    const who = h.actor || "Κάποιος";
    switch (h.action) {
      case "add":
        return `${who} πρόσθεσε ${h.driver} στις ${fmtDate(h.date)}`;
      case "remove":
        return `${who} διέγραψε ${h.driver} από τις ${fmtDate(h.date)}`;
      case "restore":
        return `${who} επανέφερε ${h.driver} στις ${fmtDate(h.date)}`;
      case "offset":
        return `${who} όρισε για ${h.driver}: ${h.detail}`;
      case "import":
        return `${who} έκανε εισαγωγή αντιγράφου (${h.detail})`;
      default:
        return `${who}: ${h.action}`;
    }
  };

  const deletedIds = useMemo(() => new Set(allEntries.filter((e) => e.deletedAt).map((e) => e.id)), [allEntries]);

  return (
    <UIContext.Provider value={ui}>
      <div
        style={{
          position: "relative",
          minHeight: "100vh",
          background: bg,
          transition: "background 0.5s ease",
          fontFamily: "'Inter', system-ui, sans-serif",
          color: ui.ink,
          overflowX: "hidden",
          paddingBottom: 30,
        }}
        onClick={closeAll}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
          .sg { font-family: 'Space Grotesk', sans-serif; }
          .daycell { transition: box-shadow .15s ease; }
          input:focus { outline: none; box-shadow: 0 0 0 3px rgba(0,0,0,0.08); }
          .hscroll::-webkit-scrollbar { height: 7px; }
          .hscroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.4); border-radius: 10px; }
          .hscroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.12); border-radius: 10px; }
        `}</style>

        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            backgroundImage: `repeating-linear-gradient(
                to bottom,
                rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 11px,
                rgba(255,255,255,0.05) 11px, rgba(255,255,255,0.05) 12px, transparent 12px, transparent 22px,
                rgba(255,255,255,0.05) 22px, rgba(255,255,255,0.05) 23px, transparent 23px, transparent 33px,
                rgba(255,255,255,0.05) 33px, rgba(255,255,255,0.05) 34px, transparent 34px, transparent 44px,
                rgba(255,255,255,0.05) 44px, rgba(255,255,255,0.05) 45px, transparent 45px, transparent 150px
              )`,
          }}
        />
        <div aria-hidden="true" className="sg" style={{ position: "fixed", top: "-4%", right: "-3%", fontSize: 340, color: "#FFFFFF", opacity: 0.06, transform: "rotate(8deg)", zIndex: 0, pointerEvents: "none", lineHeight: 1 }}>
          𝄞
        </div>
        <div aria-hidden="true" className="sg" style={{ position: "fixed", bottom: "10%", left: "-4%", fontSize: 220, color: theme.dark, opacity: 0.06, transform: "rotate(-6deg)", zIndex: 0, pointerEvents: "none", lineHeight: 1 }}>
          𝄞
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{ padding: "22px 20px 16px" }} onClick={(ev) => ev.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(0,0,0,0.2)", flexShrink: 0 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>🚗</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sg" style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.2, color: "#FFFFFF", textShadow: "0 1px 6px rgba(0,0,0,0.25)", lineHeight: 1.15 }}>
                  Δρομολόγια Μετακινήσεων Κατερίνης
                </div>
                <div style={{ fontSize: 12, color: "#FFFFFFcc", marginTop: 2 }}>Γκρουπ Μετακινήσεων 2026–2027</div>
              </div>
              <button
                onClick={toggleDark}
                aria-label={dark ? "Φωτεινό θέμα" : "Σκούρο θέμα"}
                title={dark ? "Φωτεινό θέμα" : "Σκούρο θέμα"}
                style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "#FFFFFF", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>

            <div
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.22)", borderRadius: 12, padding: "10px 10px", border: "1px solid rgba(255,255,255,0.25)" }}
            >
              <button
                onClick={() => changeMonth(-1)}
                disabled={monthIdx === 0}
                style={{ background: "none", border: "none", color: monthIdx === 0 ? "rgba(255,255,255,0.3)" : "#FFFFFF", cursor: monthIdx === 0 ? "default" : "pointer", padding: 6 }}
              >
                <ChevronLeft size={22} />
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="sg" style={{ fontWeight: 700, fontSize: 19, letterSpacing: -0.2, color: "#FFFFFF", textShadow: "0 1px 6px rgba(0,0,0,0.2)" }}>
                  {label} <span style={{ opacity: 0.7, fontWeight: 500 }}>{y}</span>
                </div>
                <button
                  onClick={goToday}
                  style={{ background: "#FFFFFF", color: theme.dark, border: "none", borderRadius: 20, padding: "4px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}
                >
                  Σήμερα
                </button>
              </div>
              <button
                onClick={() => changeMonth(1)}
                disabled={monthIdx === MONTHS.length - 1}
                style={{ background: "none", border: "none", color: monthIdx === MONTHS.length - 1 ? "rgba(255,255,255,0.3)" : "#FFFFFF", cursor: monthIdx === MONTHS.length - 1 ? "default" : "pointer", padding: 6 }}
              >
                <ChevronRight size={22} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#FFFFFFa0", marginTop: 8, textAlign: "center" }}>← σύρε το ημερολόγιο πλάγια για να δεις όλες τις μέρες →</div>
            {loadError && (
              <div style={{ marginTop: 10, background: "#FCE4E0", color: "#9C3B2E", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1 }}>{loadError}</span>
                <button onClick={reloadTrips} style={{ background: "#9C3B2E", color: "#FFFFFF", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Ξανά</button>
              </div>
            )}
          </div>

          {/* Γραμμή "Δε, Τρ, Τε..." σε κανονική ροή — "placeholder" για το κολλητό (fixed) αντίγραφο. */}
          <div ref={weekdayPlaceholderRef} style={{ margin: "6px 14px 0", background: theme.dark, borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.15)" }}>
            <div ref={weekdayInnerRef} style={{ display: "grid", gridTemplateColumns: `repeat(7, ${COL_WIDTH}px)`, gap: 8, width: "max-content", padding: "8px 0" }}>
              {DAY_LABELS.map((d, i) => (
                <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: i >= 5 ? "#FFFFFF" : "#FFFFFFb0", padding: "2px 0" }}>
                  {d}
                </div>
              ))}
            </div>
          </div>

          {fixedHeaderVisible && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, margin: "6px 14px 0", background: theme.dark, borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.25)" }}>
              <div ref={weekdayFixedInnerRef} style={{ display: "grid", gridTemplateColumns: `repeat(7, ${COL_WIDTH}px)`, gap: 8, width: "max-content", padding: "8px 0" }}>
                {DAY_LABELS.map((d, i) => (
                  <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: i >= 5 ? "#FFFFFF" : "#FFFFFFb0", padding: "2px 0" }}>
                    {d}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calendar */}
          <div className="hscroll" ref={gridScrollRef} onScroll={syncWeekdayHeader} style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", padding: "6px 0 10px" }}>
            <div style={{ width: "max-content", paddingLeft: 14, paddingRight: 14 }} onClick={(ev) => ev.stopPropagation()}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(7, ${COL_WIDTH}px)`, gap: 8 }}>
                {cells.map((d, idx) => {
                  if (d === null) return <div key={idx} />;
                  const dKey = dateKey(y, m, d);
                  const colIdx = idx % 7;
                  return (
                    <DayCell
                      key={idx}
                      d={d}
                      dKey={dKey}
                      isToday={dKey === todayKey}
                      isSelected={dKey === selectedDay}
                      isWeekend={mondayIndex(y, m, d) >= 5}
                      special={SPECIAL_DAYS[dKey]}
                      alignRight={colIdx >= 4}
                      dayEntries={byDate[dKey] || []}
                      theme={theme}
                      canonicalOf={canonicalOf}
                      numbered={numbered}
                      palette={palette}
                      knownDrivers={knownDrivers}
                      onOpen={openDay}
                      onAdd={addEntry}
                      onRemove={removeEntry}
                      onClose={closeAll}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div onClick={(ev) => ev.stopPropagation()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {/* Σύνοψη ΜΗΝΑ */}
            <Card icon={<CalendarDays size={14} color={ui.muted} />} title={`Δρομολόγια ${label.toLowerCase()}ου ${y}`} open={open.month} onToggle={() => toggle("month")}>
              {monthDrivers.length === 0 ? (
                <div style={{ fontSize: 12.5, color: ui.muted }}>Δεν υπάρχουν ακόμη δρομολόγια αυτόν τον μήνα.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                  {monthDrivers.map((d) => {
                    const c = colorFor(d, palette);
                    return (
                      <div key={d} style={{ display: "flex", alignItems: "center", gap: 7, background: c.bg, color: c.ink, borderRadius: 8, padding: "6px 12px", borderLeft: `3px solid ${c.dash}` }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{d}</span>
                        <span className="sg" style={{ fontSize: 14, fontWeight: 700 }}>{monthTotals[d]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Σύνολα ΕΤΟΥΣ + ισορροπία */}
            {knownDrivers.length > 0 && (
              <Card icon={<Users size={14} color={ui.muted} />} title="Σύνολο έτους & ισορροπία δρομολογίων" open={open.year} onToggle={() => toggle("year")}>
                <div style={{ fontSize: 12, color: ui.muted, marginBottom: 10 }}>
                  Μέσος όρος: <b style={{ color: ui.ink }}>{fmtNum(balance.avg)}</b> δρομολόγια ανά οδηγό.{" "}
                  {balance.behind.length > 0 ? (
                    <>
                      Πιο πίσω αυτή τη στιγμή:{" "}
                      <b style={{ color: ui.ink }}>
                        {balance.behind.map((r) => `${r.name} (${fmtNum(r.diff)})`).join(", ")}
                      </b>
                      .
                    </>
                  ) : (
                    "Όλοι είναι πολύ κοντά στον μέσο όρο ✓"
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {balance.rows.map((r) => {
                    const c = colorFor(r.name, palette);
                    const near = Math.abs(r.diff) < 0.75;
                    const pillBg = near ? "#DDF2E4" : r.diff > 0 ? "#FDEFD8" : "#E4E9F7";
                    const pillInk = near ? "#1F6A3A" : r.diff > 0 ? "#8A5F1E" : "#334A8A";
                    return (
                      <div key={r.name} style={{ display: "grid", gridTemplateColumns: "minmax(70px, 1.1fr) 2fr auto", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: ui.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                        <div style={{ position: "relative", height: 16, background: ui.panel, borderRadius: 8, overflow: "hidden" }}>
                          <div style={{ width: `${(r.year / balance.max) * 100}%`, height: "100%", background: c.dash, borderRadius: 8, transition: "width .3s" }} />
                          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(balance.avg / balance.max) * 100}%`, width: 2, background: ui.ink, opacity: 0.45 }} title="Μέσος όρος" />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", minWidth: 96 }}>
                          <span className="sg" style={{ fontSize: 14, fontWeight: 700, color: ui.ink }}>{r.year}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, background: pillBg, color: pillInk, borderRadius: 20, padding: "2px 8px", minWidth: 34, textAlign: "center" }}>
                            {near ? "✓" : `${r.diff > 0 ? "+" : "−"}${fmtNum(Math.abs(r.diff))}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10.5, color: ui.hint, marginTop: 8 }}>Η κάθετη γραμμή δείχνει τον μέσο όρο. Το ✓ σημαίνει ότι ο οδηγός είναι μέσα σε ±0,75 από αυτόν.</div>

                <div style={{ height: 1, background: ui.rule, margin: "12px 0 10px" }} />
                <button onClick={() => setOffsetPanelOpen((v) => !v)} style={{ background: "none", border: "none", color: ui.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5 }}>
                  {offsetPanelOpen ? "▾" : "▸"} Νέος οδηγός / αρχικός αριθμός δρομολογίων
                </button>
                {offsetPanelOpen && <OffsetForm knownDrivers={knownDrivers} driverOffsets={driverOffsets} onSave={setDriverOffset} theme={theme} />}
              </Card>
            )}
            {knownDrivers.length === 0 && (
              <Card icon={<Users size={14} color={ui.muted} />} title="Νέος οδηγός / αρχικός αριθμός δρομολογίων" open={offsetPanelOpen} onToggle={() => setOffsetPanelOpen((v) => !v)}>
                <OffsetForm knownDrivers={knownDrivers} driverOffsets={driverOffsets} onSave={setDriverOffset} theme={theme} />
              </Card>
            )}

            {/* Ιστορικό αλλαγών */}
            <Card icon={<History size={14} color={ui.muted} />} title="Ιστορικό αλλαγών (ποιος έκανε τι)" open={open.history} onToggle={() => toggle("history")}>
              {history.length === 0 ? (
                <div style={{ fontSize: 12.5, color: ui.muted }}>Δεν υπάρχουν ακόμη καταγραφές.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 320, overflowY: "auto" }}>
                  {history.map((h) => (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${ui.rule}`, fontSize: 12.5 }}>
                      <span style={{ color: ui.hint, fontSize: 11, flexShrink: 0, width: 92, whiteSpace: "nowrap" }}>{fmtTime(h.at)}</span>
                      <span style={{ flex: 1, color: ui.ink2 }}>{actionLabel(h)}</span>
                      {h.action === "remove" && h.trip_id && deletedIds.has(h.trip_id) && (
                        <button onClick={() => restoreEntry(h.trip_id)} style={{ ...dataBtnStyle, padding: "4px 9px", fontSize: 11.5, flexShrink: 0 }}>
                          <RotateCcw size={12} /> Επαναφορά
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Δεδομένα & αναφορές */}
            <Card icon={<span style={{ fontSize: 13 }}>📦</span>} title="Αναφορά μήνα, δεδομένα & αντίγραφα" open={open.data} onToggle={() => toggle("data")}>
              <div style={{ fontSize: 11.5, color: ui.muted, marginBottom: 8 }}>Αναφορά για τον μήνα που βλέπεις ({label} {y}):</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                <button onClick={() => printMonth(monthExport())} style={dataBtnStyle}><Printer size={14} /> PDF / Εκτύπωση</button>
                <button onClick={() => exportMonthXlsx(monthExport(), `dromologia-${y}-${pad(m)}.xlsx`).catch(() => window.alert("Η δημιουργία του Excel απέτυχε."))} style={dataBtnStyle}><FileSpreadsheet size={14} /> Excel (.xlsx)</button>
              </div>

              <div style={{ fontSize: 11.5, color: ui.muted, marginBottom: 8 }}>Όλα τα δεδομένα — κράτα αντίγραφο ή μετέφερέ τα αλλού:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button onClick={exportJSON} style={dataBtnStyle}>⬇️ Αντίγραφο (JSON)</button>
                <button onClick={exportCSV} style={dataBtnStyle}>⬇️ Όλο το έτος (CSV)</button>
                <button onClick={() => fileInputRef.current?.click()} style={dataBtnStyle}>⬆️ Εισαγωγή αντιγράφου</button>
              </div>
              <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: "none" }} />

              <div style={{ height: 1, background: ui.rule, margin: "14px 0 10px" }} />
              <button onClick={loadBackups} style={{ background: "none", border: "none", color: ui.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                ▸ Αυτόματα αντίγραφα ασφαλείας (ένα ανά μέρα)
              </button>
              {backups && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {backups.length === 0 && <span style={{ fontSize: 12, color: ui.muted }}>Δεν υπάρχουν ακόμη.</span>}
                  {backups.map((b) => (
                    <button
                      key={b.day}
                      onClick={() => downloadFile(`dromologia-backup-${b.day}.json`, JSON.stringify(b.data, null, 2), "application/json")}
                      style={{ ...dataBtnStyle, padding: "4px 9px", fontSize: 11.5 }}
                      title={`${(b.data.entries || []).length} δρομολόγια`}
                    >
                      ⬇️ {b.day.split("-").reverse().join("/")}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ height: 1, background: ui.rule, margin: "14px 0 10px" }} />
              <div style={{ fontSize: 11.5, color: ui.muted, lineHeight: 1.5 }}>
                <b style={{ color: ui.ink2 }}>Εγκατάσταση στο κινητό:</b> Android (Chrome): ⋮ → «Προσθήκη στην αρχική οθόνη». iPhone (Safari): κουμπί Κοινοποίηση → «Προσθήκη στην οθόνη Αφετηρίας».
              </div>
              {installEvt && (
                <button
                  onClick={async () => {
                    installEvt.prompt();
                    await installEvt.userChoice.catch(() => null);
                    setInstallEvt(null);
                  }}
                  style={{ ...dataBtnStyle, marginTop: 8 }}
                >
                  📲 Εγκατάσταση εφαρμογής
                </button>
              )}
            </Card>

            <div style={{ margin: "18px 14px 10px", textAlign: "center", fontSize: 12, color: dark ? ui.muted : "#FFFFFFcc", display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <span>Συνδεδεμένος ως <b>{actor}</b></span>
              <button onClick={onRename} style={{ background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", fontSize: 12, padding: 0 }}>Αλλαγή ονόματος</button>
              <button onClick={onSignOut} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 12, padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <LogOut size={12} /> Έξοδος (θα χρειαστείς ξανά το λινκ)
              </button>
            </div>
          </div>

          {!loaded && <div style={{ textAlign: "center", padding: 20, color: "#FFFFFFcc", fontSize: 12.5 }}>Φόρτωση...</div>}
        </div>

        {toast && (
          <div
            onClick={(ev) => ev.stopPropagation()}
            style={{ position: "fixed", left: "50%", bottom: 22, transform: "translateX(-50%)", zIndex: 60, background: "#23262B", color: "#FFFFFF", borderRadius: 12, padding: "11px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", maxWidth: "calc(100vw - 28px)" }}
          >
            <span>{toast.msg}</span>
            {toast.undoId && (
              <button onClick={() => restoreEntry(toast.undoId)} style={{ background: theme.accent, color: "#FFFFFF", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                Αναίρεση
              </button>
            )}
          </div>
        )}
      </div>
    </UIContext.Provider>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = ελέγχουμε ακόμη
  const [actor, setActor] = useState(() => lsGet("dk-actor") || "");
  const [renaming, setRenaming] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let s = await auth.getSession();
      if (!s && LINK_KEY) {
        try {
          await auth.signIn(LINK_KEY);
          s = await auth.getSession();
        } catch (e) {
          if (alive) setLinkFailed(true);
        }
      }
      if (alive) setSession(s);
    })();
    const off = auth.onChange((s) => setSession(s));
    return () => {
      alive = false;
      off();
    };
  }, []);

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#10233F", color: "#FFFFFFcc", fontFamily: "system-ui, sans-serif" }}>Φόρτωση...</div>;
  }
  if (!session) {
    return (
      <Login
        initialName={actor}
        notice={linkFailed ? "Το λινκ δεν ισχύει πια. Ζήτα νέο από τον Σάββα ή γράψε εδώ το κλειδί." : ""}
        onDone={(n) => {
          lsSet("dk-actor", n);
          setActor(n);
        }}
      />
    );
  }
  if (!actor || renaming) {
    return (
      <Login
        initialName={actor}
        needPassword={false}
        onDone={(n) => {
          lsSet("dk-actor", n);
          setActor(n);
          setRenaming(false);
        }}
      />
    );
  }
  return <Calendar actor={actor} onRename={() => setRenaming(true)} onSignOut={() => auth.signOut()} />;
}
