# Δρομολόγια Μετακινήσεων Κατερίνης (v3)

React + Vite + Supabase, δημοσιευμένο στο GitHub Pages.

## Τι περιέχει
- `src/App.jsx` — η εφαρμογή (ημερολόγιο, ισορροπία δρομολογίων, ιστορικό, εξαγωγές)
- `src/storage.js` — όλη η επικοινωνία με το Supabase + ο κοινός λογαριασμός ομάδας (`SHARED_EMAIL`)
- `src/Login.jsx` — οθόνη εισόδου (όνομα + κλειδί ομάδας). Κανονικά οι συνάδελφοι μπαίνουν από λινκ της μορφής `…/#k=ΚΛΕΙΔΙ`, οπότε δεν πληκτρολογούν τίποτα εκτός από το όνομά τους.
- `src/holidays.js` — αργίες/ημέρες χωρίς μάθημα (ενδεικτικές, διόρθωσέ τες)
- `src/exporters.js` — Excel και PDF (μήνας ή όλη η χρονιά)
- `public/` — εικονίδια, manifest και service worker (εγκατάσταση στο κινητό)
- `supabase_schema_v2.sql` — το script της βάσης (τρέχει στο Supabase → SQL Editor)

## Τοπική εκτέλεση
```
npm install
npm run dev
```
Χρειάζεται αρχείο `.env` με `VITE_SUPABASE_URL` και `VITE_SUPABASE_ANON_KEY` (δες `.env.example`).
