-- ============================================================
-- Δρομολόγια Μετακινήσεων Κατερίνης — Supabase schema v2
-- Τρέξε ΟΛΟΚΛΗΡΟ το script στο: Supabase → SQL Editor → New query → Run
--
-- Τι κάνει:
--  1. Φτιάχνει πίνακα "trips": ένα row ανά δρομολόγιο (όχι πια μία μεγάλη λίστα),
--     ώστε δύο άνθρωποι που γράφουν ταυτόχρονα να μη σβήνουν ο ένας τον άλλον.
--     Οι διαγραφές είναι "μαλακές" (deleted_at), άρα υπάρχει αναίρεση/κάδος.
--  2. Φτιάχνει "history" (ιστορικό αλλαγών) και "backups" (μία αποθήκευση ανά μέρα).
--  3. Μεταφέρει τα υπάρχοντα δεδομένα από τον παλιό πίνακα app_storage.
--  4. Κλειδώνει την πρόσβαση: μόνο συνδεδεμένοι χρήστες (με τον κοινό κωδικό).
-- Το script μπορεί να τρέξει και δεύτερη φορά χωρίς πρόβλημα.
-- ============================================================

-- 1. Δρομολόγια -------------------------------------------------
create table if not exists trips (
  id          text primary key,
  date        text not null,                 -- μορφή YYYY-MM-DD
  driver      text not null,
  ts          double precision not null,     -- σειρά καταχώρησης μέσα στη μέρα
  created_by  text,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,                   -- γεμάτο = διαγραμμένο (στον κάδο)
  deleted_by  text
);
create index if not exists trips_date_idx on trips (date);

-- 2. Ιστορικό αλλαγών -------------------------------------------
create table if not exists history (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   text,
  action  text not null,        -- add | remove | restore | offset | import
  trip_id text,
  date    text,
  driver  text,
  detail  text
);
create index if not exists history_at_idx on history (at desc);

-- 3. Καθημερινά αντίγραφα ασφαλείας -----------------------------
create table if not exists backups (
  day        date primary key,
  created_at timestamptz not null default now(),
  data       jsonb not null
);

-- 4. Μεταφορά των παλιών δεδομένων (μόνο αν δεν έχει ήδη γίνει) --
insert into trips (id, date, driver, ts)
select e->>'id',
       e->>'date',
       e->>'driver',
       coalesce((e->>'ts')::double precision, 0)
from app_storage s,
     jsonb_array_elements(s.value) as e
where s.key = 'route-entries'
  and jsonb_typeof(s.value) = 'array'
on conflict (id) do nothing;

-- 5. Ασφάλεια (RLS): ΜΟΝΟ συνδεδεμένοι χρήστες -------------------
alter table trips      enable row level security;
alter table history    enable row level security;
alter table backups    enable row level security;
alter table app_storage enable row level security;

-- Σβήνουμε τις παλιές ανοιχτές πολιτικές
drop policy if exists "allow read app_storage"   on app_storage;
drop policy if exists "allow write app_storage"  on app_storage;
drop policy if exists "allow update app_storage" on app_storage;

drop policy if exists "auth all app_storage" on app_storage;
create policy "auth all app_storage" on app_storage
  for all to authenticated using (true) with check (true);

-- trips: διάβασμα / προσθήκη / τροποποίηση — ΟΧΙ φυσική διαγραφή
drop policy if exists "auth select trips" on trips;
drop policy if exists "auth insert trips" on trips;
drop policy if exists "auth update trips" on trips;
create policy "auth select trips" on trips for select to authenticated using (true);
create policy "auth insert trips" on trips for insert to authenticated with check (true);
create policy "auth update trips" on trips for update to authenticated using (true) with check (true);

-- history: μόνο προσθήκη και διάβασμα (δεν αλλάζει ποτέ)
drop policy if exists "auth select history" on history;
drop policy if exists "auth insert history" on history;
create policy "auth select history" on history for select to authenticated using (true);
create policy "auth insert history" on history for insert to authenticated with check (true);

-- backups: μόνο προσθήκη και διάβασμα
drop policy if exists "auth select backups" on backups;
drop policy if exists "auth insert backups" on backups;
create policy "auth select backups" on backups for select to authenticated using (true);
create policy "auth insert backups" on backups for insert to authenticated with check (true);

-- 6. Realtime (αυτόματη ενημέρωση των άλλων οθονών) --------------
do $$
begin
  begin
    alter publication supabase_realtime add table trips;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table history;
  exception when duplicate_object then null;
  end;
end $$;

-- Έλεγχος: πόσα δρομολόγια μεταφέρθηκαν
select count(*) as dromologia_pou_metaferthikan from trips;
