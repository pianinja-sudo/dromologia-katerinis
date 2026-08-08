import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, X, ChevronLeft, ChevronRight, Users, CalendarDays } from "lucide-react";
import { storage, subscribeToChanges } from "./storage";

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
];

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
function normalizeName(s) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
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
// το κελί, ΟΧΙ fixed/viewport). Ανοίγει ακριβώς εκεί που πάτησες, χωρίς
// backdrop, χωρίς animation timers, χωρίς υπολογισμούς vh. Τοπικό state ώστε
// η πληκτρολόγηση να μην αγγίζει το ημερολόγιο.
// ---------------------------------------------------------------------------
function DayPopover({ dKey, theme, dayEntries, canonicalOf, numbered, palette, knownDrivers, onAdd, onRemove, onClose, alignRight }) {
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
        background: "#FFFDF8",
        borderRadius: 14,
        padding: "14px 14px 12px",
        boxShadow: "0 14px 34px rgba(0,0,0,0.28)",
        border: "1px solid #EDE8D9",
        cursor: "default",
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
          border: "2px solid #FFFDF8",
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
                  title="Διαγραφή"
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
            border: "1.5px solid #E6E2D4",
            background: "#FFFFFF",
            color: "#23262B",
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
      <div style={{ fontSize: 10, color: "#B7B2A0", marginTop: 5 }}>Πολλά ονόματα; Χώρισέ τα με κόμμα.</div>

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
                  background: already ? "#F7F6F1" : "#F3F1EA",
                  color: already ? "#C7C3B5" : "#5B5748",
                  border: "1px solid #E6E2D4",
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
// DayCell — memoized. Το popover ζει ΜΕΣΑ σε αυτό (position: relative στο
// κελί), οπότε δεν ξαναρεντράρει ο υπόλοιπος πίνακας όταν πληκτρολογείς.
// ---------------------------------------------------------------------------
const DayCell = React.memo(function DayCell({ d, dKey, isToday, isSelected, isWeekend, alignRight, dayEntries, theme, canonicalOf, numbered, palette, knownDrivers, onOpen, onAdd, onRemove, onClose }) {
  return (
    <div style={{ position: "relative" }}>
      <div
        className="daycell"
        onClick={() => onOpen(dKey)}
        style={{
          minHeight: 128,
          borderRadius: 13,
          border: isSelected ? `2px solid ${theme.accent}` : isToday ? `2px solid ${theme.dark}` : "1px solid rgba(35,38,43,0.08)",
          background: "#FFFFFF",
          boxShadow: isSelected ? `0 0 0 3px ${theme.accent}77` : isToday ? `0 0 0 3px ${theme.accent}55` : "0 2px 8px rgba(35,38,43,0.10)",
          padding: "8px 7px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 1px" }}>
          <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 600, color: isToday ? theme.dark : "#4A4D54" }}>{d}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {isWeekend && <span style={{ width: 5, height: 5, borderRadius: 5, background: theme.accent }} title="Σαββατοκύριακο" />}
            <Plus size={13} strokeWidth={2.5} color="#C7C3B5" />
          </div>
        </div>

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
// OffsetForm — για νέο οδηγό (ή υπάρχοντα) όρισε "αρχικό αριθμό δρομολογίων",
// ώστε να μη χρειάζεται να καταχωρηθούν ψεύτικες παλιές μέρες για να φτάσει
// στο σωστό νούμερο.
// ---------------------------------------------------------------------------
function OffsetForm({ knownDrivers, driverOffsets, onSave, theme }) {
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

  return (
    <div style={{ marginTop: 10, background: "#F9F8F4", border: "1px solid #EFEDE6", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11.5, color: "#8A8578", marginBottom: 8 }}>
        Πες μας το όνομα και τον αριθμό δρομολογίου από τον οποίο να ξεκινήσει να μετράει. π.χ. αν κλείσαμε τον μήνα στο 5, βάλε 5 — το επόμενο δρομολόγιό του θα φανεί ως 6.
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          placeholder="Όνομα οδηγού"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          style={{ flex: 1, minWidth: 0, boxSizing: "border-box", border: "1.5px solid #E6E2D4", background: "#FFFFFF", borderRadius: 8, padding: "8px 9px", fontSize: 13.5 }}
        />
        <input
          type="number"
          min="0"
          value={offset}
          onChange={(ev) => setOffset(ev.target.value)}
          placeholder="Αριθμός"
          style={{ width: 78, boxSizing: "border-box", border: "1.5px solid #E6E2D4", background: "#FFFFFF", borderRadius: 8, padding: "8px 9px", fontSize: 13.5 }}
        />
      </div>
      {knownDrivers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {knownDrivers.map((dr) => (
            <button
              key={dr}
              onClick={() => setName(dr)}
              style={{ background: "#F3F1EA", color: "#5B5748", border: "1px solid #E6E2D4", borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              {dr}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={save}
        style={{ width: "100%", background: theme.accent, color: "#FFFFFF", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        Αποθήκευση
      </button>
      {saved && <div style={{ fontSize: 11.5, color: "#4B6A2E", marginTop: 6 }}>Ρυθμίστηκε ο αρχικός αριθμός για {saved} ✓</div>}

      {Object.values(driverOffsets).length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {Object.values(driverOffsets).map((info) => (
            <div key={info.name} style={{ fontSize: 11.5, color: "#8A8578" }}>
              {info.name} — αρχικός αριθμός: {info.offset}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [driverOffsets, setDriverOffsets] = useState({}); // normalizedName -> { name, offset }
  const [loaded, setLoaded] = useState(false);
  const [monthIdx, setMonthIdx] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [offsetPanelOpen, setOffsetPanelOpen] = useState(false);
  const weekdayInnerRef = useRef(null);
  const weekdayFixedInnerRef = useRef(null);
  const weekdayPlaceholderRef = useRef(null);
  const gridScrollRef = useRef(null);
  const [fixedHeaderVisible, setFixedHeaderVisible] = useState(false);

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

  // Όταν εμφανίζεται το fixed αντίγραφο, συγχρόνισε αμέσως τη θέση του με το τρέχον οριζόντιο scroll
  useEffect(() => {
    if (fixedHeaderVisible) syncWeekdayHeader();
  }, [fixedHeaderVisible, syncWeekdayHeader]);

  const openDay = useCallback((dKey) => {
    setSelectedDay((prev) => (prev === dKey ? null : dKey));
  }, []);
  const closeAll = useCallback(() => setSelectedDay(null), []);

  const loadAll = useCallback(async () => {
    try {
      const res = await storage.get("route-entries");
      if (res && res.value) setEntries(JSON.parse(res.value));
    } catch (e) {
      // δεν υπάρχουν ακόμη δεδομένα
    }
    try {
      const res2 = await storage.get("driver-offsets");
      if (res2 && res2.value) setDriverOffsets(JSON.parse(res2.value));
    } catch (e) {
      // δεν υπάρχουν ακόμη ρυθμίσεις
    }
  }, []);

  useEffect(() => {
    loadAll().then(() => setLoaded(true));
  }, [loadAll]);

  // Real-time: όταν ένας συνάδελφος καταχωρήσει κάτι, ενημερώνεται αυτόματα και η δική σου οθόνη
  useEffect(() => {
    const unsubscribe = subscribeToChanges(() => {
      loadAll();
    });
    return unsubscribe;
  }, [loadAll]);

  const setDriverOffset = useCallback((name, offset) => {
    const nk = normalizeName(name);
    if (!nk) return;
    setDriverOffsets((prev) => {
      const next = { ...prev, [nk]: { name: name.trim(), offset } };
      storage.set("driver-offsets", JSON.stringify(next)).catch((e) => console.error("Αποτυχία αποθήκευσης", e));
      return next;
    });
  }, []);

  const addEntry = useCallback((dKey, names) => {
    const base = Date.now();
    setEntries((prev) => {
      // Ονόματα που υπάρχουν ήδη αυτή τη μέρα (κανονικοποιημένα) — αποτροπή διπλοκαταχώρησης
      const existingNorm = new Set(
        expandEntries(prev)
          .filter((e) => e.date === dKey)
          .map((e) => normalizeName(e.driver))
      );
      const seenThisBatch = new Set();
      const toAdd = [];
      names.forEach((name) => {
        const nk = normalizeName(name);
        if (!nk || existingNorm.has(nk) || seenThisBatch.has(nk)) return;
        seenThisBatch.add(nk);
        toAdd.push(name);
      });
      if (toAdd.length === 0) return prev;
      const next = [
        ...prev,
        ...toAdd.map((name, i) => ({
          id: `${base}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          date: dKey,
          driver: name,
          ts: base + i,
        })),
      ];
      storage.set("route-entries", JSON.stringify(next)).catch((e) => console.error("Αποτυχία αποθήκευσης", e));
      return next;
    });
  }, []);

  const removeEntry = useCallback((id, originalId) => {
    const targetId = originalId || id;
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== targetId);
      storage.set("route-entries", JSON.stringify(next)).catch((e) => console.error("Αποτυχία αποθήκευσης", e));
      return next;
    });
  }, []);

  // --- Εξαγωγή / Εισαγωγή δεδομένων — ώστε να είναι μεταφέρσιμα αλλού ή σε νέα έκδοση ---
  const fileInputRef = useRef(null);

  const downloadFile = (filename, content, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const todayStamp = () => {
    const t = new Date();
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  };

  const exportJSON = () => {
    const payload = { app: "dromologia-katerinis", exportedAt: new Date().toISOString(), entries, driverOffsets };
    downloadFile(`dromologia-antigrafo-${todayStamp()}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  const csvEscape = (v) => `"${String(v).replace(/"/g, '""')}"`;

  const exportCSV = () => {
    const expanded = expandEntries(entries);
    const canonicalMap = {};
    [...expanded].sort((a, b) => a.ts - b.ts).forEach((e) => {
      const nk = normalizeName(e.driver);
      if (!canonicalMap[nk]) canonicalMap[nk] = e.driver;
    });
    const counters = {};
    const rows = [["Ημερομηνία", "Οδηγός", "Αρ. Δρομολογίου"]];
    [...expanded]
      .sort((a, b) => (a.date === b.date ? a.ts - b.ts : a.date.localeCompare(b.date)))
      .forEach((e) => {
        const canon = canonicalMap[normalizeName(e.driver)] || e.driver;
        counters[canon] = (counters[canon] || 0) + 1;
        rows.push([e.date, canon, counters[canon]]);
      });
    const csv = "\uFEFF" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
    downloadFile(`dromologia-${todayStamp()}.csv`, csv, "text/csv;charset=utf-8");
  };

  const handleImportFile = (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || !Array.isArray(data.entries)) throw new Error("invalid");
        const ok = window.confirm("Η εισαγωγή θα αντικαταστήσει όλα τα τρέχοντα δεδομένα της εφαρμογής. Συνέχεια;");
        if (!ok) return;
        const offs = data.driverOffsets && typeof data.driverOffsets === "object" ? data.driverOffsets : {};
        setEntries(data.entries);
        setDriverOffsets(offs);
        storage.set("route-entries", JSON.stringify(data.entries)).catch(() => {});
        storage.set("driver-offsets", JSON.stringify(offs)).catch(() => {});
      } catch (e) {
        window.alert("Το αρχείο δεν αναγνωρίστηκε ως έγκυρο αντίγραφο δεδομένων.");
      }
    };
    reader.readAsText(file);
  };

  const dataBtnStyle = { background: "#F3F1EA", color: "#5B5748", border: "1px solid #E6E2D4", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };

  const { numbered, canonicalOf, byDate, totals, knownDrivers, palette } = useMemo(() => {
    const expanded = expandEntries(entries);
    const sorted = [...expanded].sort((a, b) => a.ts - b.ts);
    const canonicalMap = {};
    // Πρώτα "σπέρνουμε" τα ονόματα που έχουν ήδη ρυθμισμένο αρχικό αριθμό, ώστε
    // η πρώτη πραγματική καταχώρηση ενός νέου οδηγού να ταιριάξει με το σωστό όνομα.
    Object.values(driverOffsets).forEach((info) => {
      const nk = normalizeName(info.name);
      if (!canonicalMap[nk]) canonicalMap[nk] = info.name;
    });
    sorted.forEach((e) => {
      const nk = normalizeName(e.driver);
      if (!canonicalMap[nk]) canonicalMap[nk] = e.driver;
    });
    const canonicalOf = (raw) => canonicalMap[normalizeName(raw)] || raw;
    const offsetOf = (canonicalName) => {
      const info = driverOffsets[normalizeName(canonicalName)];
      return info ? info.offset : 0;
    };

    const counters = {};
    const numbered = {};
    const totals = {};
    const chronoByDate = [...expanded].sort((a, b) =>
      a.date === b.date ? a.ts - b.ts : a.date.localeCompare(b.date)
    );
    chronoByDate.forEach((e) => {
      const c = canonicalOf(e.driver);
      if (counters[c] === undefined) counters[c] = offsetOf(c);
      counters[c] += 1;
      numbered[e.id] = counters[c];
      totals[c] = counters[c];
    });
    // Οδηγοί με ρυθμισμένο αρχικό αριθμό αλλά καμία πραγματική καταχώρηση ακόμη —
    // να εμφανίζονται κι αυτοί στο ετήσιο σύνολο με τον αρχικό τους αριθμό.
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
    const palette = {};
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

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: `linear-gradient(175deg, ${theme.dark} 0%, ${theme.darkSoft} 16%, ${theme.accent} 46%, ${theme.light} 78%, ${theme.light} 100%)`,
        transition: "background 0.5s ease",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#23262B",
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
      <div
        aria-hidden="true"
        className="sg"
        style={{ position: "fixed", top: "-4%", right: "-3%", fontSize: 340, color: "#FFFFFF", opacity: 0.06, transform: "rotate(8deg)", zIndex: 0, pointerEvents: "none", lineHeight: 1 }}
      >
        𝄞
      </div>
      <div
        aria-hidden="true"
        className="sg"
        style={{ position: "fixed", bottom: "10%", left: "-4%", fontSize: 220, color: theme.dark, opacity: 0.06, transform: "rotate(-6deg)", zIndex: 0, pointerEvents: "none", lineHeight: 1 }}
      >
        𝄞
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ padding: "22px 20px 16px" }} onClick={(ev) => ev.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(0,0,0,0.2)", flexShrink: 0 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>🚗</span>
            </div>
            <div>
              <div className="sg" style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.2, color: "#FFFFFF", textShadow: "0 1px 6px rgba(0,0,0,0.25)", lineHeight: 1.15 }}>
                Δρομολόγια Μετακινήσεων Κατερίνης
              </div>
              <div style={{ fontSize: 12, color: "#FFFFFFcc", marginTop: 2 }}>Γκρουπ Μετακινήσεων 2026–2027</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.22)", borderRadius: 12, padding: "10px 10px", border: "1px solid rgba(255,255,255,0.25)" }}>
            <button
              onClick={() => { setMonthIdx((i) => Math.max(0, i - 1)); setSelectedDay(null); }}
              disabled={monthIdx === 0}
              style={{ background: "none", border: "none", color: monthIdx === 0 ? "rgba(255,255,255,0.3)" : "#FFFFFF", cursor: monthIdx === 0 ? "default" : "pointer", padding: 6 }}
            >
              <ChevronLeft size={22} />
            </button>
            <div className="sg" style={{ fontWeight: 700, fontSize: 19, letterSpacing: -0.2, color: "#FFFFFF", textShadow: "0 1px 6px rgba(0,0,0,0.2)" }}>
              {label} <span style={{ opacity: 0.7, fontWeight: 500 }}>{y}</span>
            </div>
            <button
              onClick={() => { setMonthIdx((i) => Math.min(MONTHS.length - 1, i + 1)); setSelectedDay(null); }}
              disabled={monthIdx === MONTHS.length - 1}
              style={{ background: "none", border: "none", color: monthIdx === MONTHS.length - 1 ? "rgba(255,255,255,0.3)" : "#FFFFFF", cursor: monthIdx === MONTHS.length - 1 ? "default" : "pointer", padding: 6 }}
            >
              <ChevronRight size={22} />
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#FFFFFFa0", marginTop: 8, textAlign: "center" }}>← σύρε το ημερολόγιο πλάγια για να δεις όλες τις μέρες →</div>
        </div>

        {/* Γραμμή "Δε, Τρ, Τε..." σε κανονική ροή — λειτουργεί σαν "placeholder" για να
            ξέρουμε πότε να εμφανίσουμε το κολλητό (fixed) αντίγραφο από κάτω. */}
        <div ref={weekdayPlaceholderRef} style={{ margin: "6px 14px 0", background: theme.dark, borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 10px rgba(0,0,0,0.15)" }}>
          <div
            ref={weekdayInnerRef}
            style={{ display: "grid", gridTemplateColumns: `repeat(7, ${COL_WIDTH}px)`, gap: 8, width: "max-content", padding: "8px 0" }}
          >
            {DAY_LABELS.map((d, i) => (
              <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: i >= 5 ? "#FFFFFF" : "#FFFFFFb0", padding: "2px 0" }}>
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Κολλητό αντίγραφο — ΠΑΝΤΑ position:fixed (όχι sticky), εμφανίζεται μόνο όταν
            το παραπάνω placeholder φύγει από την κορυφή της οθόνης. Το fixed δεν
            επηρεάζεται από overflow ρυθμίσεις προγόνων, οπότε δουλεύει αξιόπιστα. */}
        {fixedHeaderVisible && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 40,
              margin: "6px 14px 0",
              background: theme.dark,
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
            }}
          >
            <div
              ref={weekdayFixedInnerRef}
              style={{ display: "grid", gridTemplateColumns: `repeat(7, ${COL_WIDTH}px)`, gap: 8, width: "max-content", padding: "8px 0" }}
            >
              {DAY_LABELS.map((d, i) => (
                <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: i >= 5 ? "#FFFFFF" : "#FFFFFFb0", padding: "2px 0" }}>
                  {d}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calendar — οριζόντιο scroll, σταθερό άνετο πλάτος κελιού. Πάτα μια μέρα: το πλαίσιο ανοίγει αμέσως πάνω σε αυτήν. */}
        <div
          className="hscroll"
          ref={gridScrollRef}
          onScroll={syncWeekdayHeader}
          style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", padding: "6px 0 10px" }}
        >
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

        <div onClick={(ev) => ev.stopPropagation()}>
          {/* Σύνοψη ΜΗΝΑ */}
          {monthDrivers.length > 0 && (
            <div style={{ margin: "14px 14px 0", background: "#FFFFFF", border: "1px solid rgba(35,38,43,0.08)", boxShadow: "0 4px 16px rgba(35,38,43,0.12)", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                <CalendarDays size={14} color="#8A8D95" />
                <span className="sg" style={{ fontSize: 12.5, fontWeight: 600, color: "#6B6E75" }}>Δρομολόγια {label.toLowerCase()}ου {y}</span>
              </div>
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
            </div>
          )}

          {/* Σύνοψη ΕΤΟΥΣ */}
          {knownDrivers.length > 0 && (
            <div style={{ margin: "14px 14px 24px", background: "#FFFFFF", border: "1px solid rgba(35,38,43,0.08)", boxShadow: "0 4px 16px rgba(35,38,43,0.12)", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                <Users size={14} color="#8A8D95" />
                <span className="sg" style={{ fontSize: 12.5, fontWeight: 600, color: "#6B6E75" }}>Σύνολο δρομολογίων (όλο το έτος)</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {knownDrivers.map((d) => {
                  const c = colorFor(d, palette);
                  return (
                    <div key={d} style={{ display: "flex", alignItems: "center", gap: 7, background: c.bg, color: c.ink, borderRadius: 8, padding: "6px 12px", borderLeft: `3px solid ${c.dash}` }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{d}</span>
                      <span className="sg" style={{ fontSize: 14, fontWeight: 700 }}>{totals[d]}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ height: 1, background: "#EFEDE6", margin: "12px 0 10px" }} />

              <button
                onClick={() => setOffsetPanelOpen((v) => !v)}
                style={{ background: "none", border: "none", color: "#8A8D95", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5 }}
              >
                {offsetPanelOpen ? "▾" : "▸"} Νέος οδηγός / αρχικός αριθμός δρομολογίων
              </button>

              {offsetPanelOpen && (
                <OffsetForm knownDrivers={knownDrivers} driverOffsets={driverOffsets} onSave={setDriverOffset} theme={theme} />
              )}
            </div>
          )}

          {/* Δεδομένα — εξαγωγή/εισαγωγή, ώστε να είναι μεταφέρσιμα αλλού ή σε νέα έκδοση της εφαρμογής */}
          <div style={{ margin: "14px 14px 24px", background: "#FFFFFF", border: "1px solid rgba(35,38,43,0.08)", boxShadow: "0 4px 16px rgba(35,38,43,0.12)", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
              <span style={{ fontSize: 14 }}>📦</span>
              <span className="sg" style={{ fontSize: 12.5, fontWeight: 600, color: "#6B6E75" }}>Δεδομένα</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#9A9788", marginBottom: 10 }}>
              Κράτα αντίγραφο ή μετέφερέ τα αλλού — σε νέα έκδοση της εφαρμογής, σε υπολογιστή, ή σε Excel/Sheets.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button onClick={exportJSON} style={dataBtnStyle}>⬇️ Αντίγραφο (JSON)</button>
              <button onClick={exportCSV} style={dataBtnStyle}>⬇️ Excel/Sheets (CSV)</button>
              <button onClick={() => fileInputRef.current?.click()} style={dataBtnStyle}>⬆️ Εισαγωγή αντιγράφου</button>
            </div>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: "none" }} />
          </div>
        </div>

        {!loaded && <div style={{ textAlign: "center", padding: 20, color: "#FFFFFFcc", fontSize: 12.5 }}>Φόρτωση...</div>}
      </div>
    </div>
  );
}
