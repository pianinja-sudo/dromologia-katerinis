import { createClient } from "@supabase/supabase-js";

// Αυτές τις δύο τιμές τις παίρνεις από το Supabase: Project Settings → API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Βοηθητικό μήνυμα σε περίπτωση που ξεχάστηκε το .env
  console.error(
    "Λείπουν οι μεταβλητές VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Δες το αρχείο .env.example."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
