import { supabase } from "./supabaseClient";

// Ίδια "μορφή" με το window.storage του Claude artifact (get/set με key/value),
// ώστε το App.jsx να χρειάζεται ελάχιστες αλλαγές. Από πίσω, μιλάει με το
// Supabase, οπότε τα δεδομένα είναι κοινά για όλους τους συναδέλφους.

export const storage = {
  async get(key) {
    const { data, error } = await supabase
      .from("app_storage")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    // Το App.jsx περιμένει { value: <string JSON> } όπως το window.storage,
    // οπότε το ξανακάνουμε string εδώ.
    return { key, value: JSON.stringify(data.value) };
  },

  async set(key, value) {
    const parsed = JSON.parse(value);
    const { error } = await supabase
      .from("app_storage")
      .upsert({ key, value: parsed, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { key, value };
  },
};

// Ειδοποιεί τον callback όποτε κάποιος συνάδελφος αλλάξει δεδομένα,
// ώστε η οθόνη να ανανεώνεται αυτόματα χωρίς χειροκίνητο refresh.
export function subscribeToChanges(onChange) {
  const channel = supabase
    .channel("app_storage_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_storage" },
      (payload) => onChange(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
