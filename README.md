# Δρομολόγια Μετακινήσεων Κατερίνης

Κοινό ημερολόγιο δρομολογίων για το Μουσικό Σχολείο Κατερίνης. Backend: Supabase (κοινά δεδομένα σε πραγματικό χρόνο). Hosting: GitHub Pages.

## 1. Supabase — δημιουργία βάσης

1. Μπες στον υπάρχοντα λογαριασμό σου στο [supabase.com](https://supabase.com) → **New project**.
2. Μόλις δημιουργηθεί, πήγαινε **SQL Editor → New query**, επικόλλησε ολόκληρο το περιεχόμενο του αρχείου `supabase_schema.sql` (σου το έδωσα ξεχωριστά) και πάτα **Run**.
3. Πήγαινε **Project Settings → API**. Θα χρειαστείς δύο τιμές:
   - **Project URL**
   - **anon public key**

## 2. Τοπική δοκιμή (προαιρετικό, πριν το ανεβάσεις online)

```bash
npm install
cp .env.example .env
# άνοιξε το .env και βάλε τις δύο τιμές από το Supabase
npm run dev
```

Θα ανοίξει σε `http://localhost:5173`.

## 3. Ανέβασμα στο GitHub

```bash
git init
git add .
git commit -m "Πρώτη έκδοση"
git branch -M main
git remote add origin https://github.com/<το-username-σου>/dromologia-katerinis.git
git push -u origin main
```

(Δημιούργησε πρώτα ένα άδειο repository στο GitHub με το ίδιο όνομα, χωρίς README/.gitignore, πριν κάνεις push.)

## 4. Σύνδεση των Supabase κλειδιών με το GitHub (secrets)

Στο repository σου στο GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Πρόσθεσε:

- `VITE_SUPABASE_URL` → το Project URL από το βήμα 1
- `VITE_SUPABASE_ANON_KEY` → το anon public key από το βήμα 1

## 5. Ενεργοποίηση GitHub Pages

**Settings → Pages → Source → GitHub Actions** (όχι "Deploy from a branch").

Αυτό είναι όλο. Το workflow (`.github/workflows/deploy.yml`) θα τρέξει αυτόματα και σε λίγα λεπτά θα βλέπεις το live link στο **Settings → Pages** (κάτι σαν `https://<username>.github.io/dromologia-katerinis/`).

Από εδώ και πέρα, κάθε φορά που κάνεις `git push` στο `main`, το site ανανεώνεται αυτόματα.

## 6. Μοιράσου το link με τους συναδέλφους

Όλοι όσοι ανοίγουν το link βλέπουν και επεξεργάζονται τα **ίδια, κοινά δεδομένα** σε πραγματικό χρόνο — αν κάποιος καταχωρήσει δρομολόγιο, οι υπόλοιποι το βλέπουν αυτόματα, χωρίς refresh.

> ⚠️ Σημείωση ασφαλείας: προς το παρόν, όποιος έχει το link μπορεί να επεξεργαστεί δεδομένα (δεν υπάρχει ακόμη login). Αρκεί για μια μικρή, κλειστή ομάδα συναδέλφων. Αν αργότερα θέλεις έλεγχο πρόσβασης, μπορούμε να προσθέσουμε Supabase Auth.

## Μελλοντικά: Android / iOS

Το ίδιο project μπορεί αργότερα να "τυλιχτεί" με **Capacitor** (όπως το Ivory Clef) για να βγει εφαρμογή Android/iOS που θα μιλάει με την ίδια βάση Supabase — κοινά δεδομένα σε web, Android και iOS ταυτόχρονα.
