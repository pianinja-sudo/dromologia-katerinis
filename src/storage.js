import { supabase } from "./supabaseClient";

// ---------------------------------------------------------------------------
// Επίπεδο δεδομένων. Όλα περνούν από εδώ ώστε το App.jsx να μένει καθαρό.
//   trips    : ένα row ανά δρομολόγιο (μαλακή διαγραφή με deleted_at)
//   history  : ιστορικό αλλαγών (ποιος, τι, πότε)
//   backups  : ένα αντίγραφο ασφαλείας ανά μέρα
//   app_storage['driver-offsets'] : αρχικοί αριθμοί δρομολογίων ανά οδηγό
// ---------------------------------------------------------------------------

// Κοινός "λογαριασμός ομάδας". Φτιάχνεται μία φορά στο Supabase
// (Authentication → Users → Add user) με ΑΥΤΟ το email και τον κωδικό της ομάδας.
export const SHARED_EMAIL = "omada@katerini-metakiniseis.com";

const rowToEntry = (r) => ({
  id: r.id,
  date: r.date,
  driver: r.driver,
  ts: r.ts,
  createdBy: r.created_by || "",
  deletedAt: r.deleted_at || null,
  deletedBy: r.deleted_by || "",
});

const entryToRow = (e, actor) => ({
  id: e.id,
  date: e.date,
  driver: e.driver,
  ts: e.ts,
  created_by: actor || null,
  deleted_at: null,
  deleted_by: null,
});

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ---- Σύνδεση -------------------------------------------------------------
export const auth = {
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  onChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
    return () => data.subscription.unsubscribe();
  },
  async signIn(password) {
    const { error } = await supabase.auth.signInWithPassword({ email: SHARED_EMAIL, password });
    if (error) throw error;
  },
  async signOut() {
    await supabase.auth.signOut();
  },
};

// ---- Δρομολόγια ----------------------------------------------------------
export const db = {
  async loadTrips() {
    // Φέρνουμε και τα διαγραμμένα (για κάδο/επαναφορά). Ο όγκος είναι μικρός.
    const all = [];
    let from = 0;
    const step = 1000;
    for (;;) {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .order("date", { ascending: true })
        .order("ts", { ascending: true })
        .range(from, from + step - 1);
      if (error) throw error;
      all.push(...data);
      if (data.length < step) break;
      from += step;
    }
    return all.map(rowToEntry);
  },

  async insertTrips(entries, actor) {
    const { error } = await supabase.from("trips").insert(entries.map((e) => entryToRow(e, actor)));
    if (error) throw error;
  },

  async softDelete(id, actor) {
    const { error } = await supabase
      .from("trips")
      .update({ deleted_at: new Date().toISOString(), deleted_by: actor || null })
      .eq("id", id);
    if (error) throw error;
  },

  async restore(id) {
    const { error } = await supabase.from("trips").update({ deleted_at: null, deleted_by: null }).eq("id", id);
    if (error) throw error;
  },

  // Για εισαγωγή αντιγράφου: όλα τα τρέχοντα πάνε στον κάδο και μπαίνουν τα νέα.
  async replaceAll(entries, actor) {
    const { error: e1 } = await supabase
      .from("trips")
      .update({ deleted_at: new Date().toISOString(), deleted_by: actor || null })
      .is("deleted_at", null);
    if (e1) throw e1;
    for (const part of chunk(entries, 500)) {
      const { error } = await supabase.from("trips").upsert(part.map((e) => entryToRow(e, actor)), { onConflict: "id" });
      if (error) throw error;
    }
  },

  // ---- Αρχικοί αριθμοί ----
  async loadOffsets() {
    const { data, error } = await supabase.from("app_storage").select("value").eq("key", "driver-offsets").maybeSingle();
    if (error) throw error;
    return data && data.value && typeof data.value === "object" ? data.value : {};
  },
  async saveOffsets(obj) {
    const { error } = await supabase
      .from("app_storage")
      .upsert({ key: "driver-offsets", value: obj, updated_at: new Date().toISOString() });
    if (error) throw error;
  },

  // ---- Ιστορικό ----
  async log(rows, actor) {
    const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ actor: actor || null, ...r }));
    if (list.length === 0) return;
    const { error } = await supabase.from("history").insert(list);
    if (error) console.error("Αποτυχία ιστορικού", error);
  },
  async loadHistory(limit = 80) {
    const { data, error } = await supabase.from("history").select("*").order("at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },

  // ---- Αντίγραφα ασφαλείας ----
  async saveDailyBackup(payload) {
    const day = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("backups")
      .upsert({ day, data: payload }, { onConflict: "day", ignoreDuplicates: true });
    if (error) console.error("Αποτυχία backup", error);
  },
  async listBackups(limit = 40) {
    const { data, error } = await supabase.from("backups").select("day, created_at, data").order("day", { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },
};

// Ειδοποιεί όταν κάποιος αλλάξει δρομολόγια ή ιστορικό (realtime).
export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel("dromologia_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => onChange("trips"))
    .on("postgres_changes", { event: "*", schema: "public", table: "history" }, () => onChange("history"))
    .on("postgres_changes", { event: "*", schema: "public", table: "app_storage" }, () => onChange("offsets"))
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
