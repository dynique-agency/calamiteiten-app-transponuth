# Calamiteiten App — Transpo-Nuth

Webapplicatie voor de registratie, berekening en rapportage van wegcalamiteiten door Transpo-Nuth buitendienst-medewerkers.

Gebouwd als HBO Ad-ICT afstudeerproject.

---

## Projectoverzicht

De applicatie stelt buitendienstmedewerkers in staat om calamiteiten op rijkswegen eenvoudig te registreren via een mobiel-vriendelijke wizard. Kantoorpersoneel (Admin) beheert stamdata, exporteert kostenoverzichten en controleert ingezonden formulieren.

**Kernfunctionaliteiten:**
- Stap-voor-stap registratie van wegcalamiteiten (rijksweg, HMP, rijrichting, materieel, collega's)
- Automatische CROW-berekening van bord-/tekenmaterieelposities
- Strukton 4-uurs facturatieregel met kwartierafronding
- Weekend-toeslagberekening (zaterdag/zondag)
- PDF-rapportage met foto's (A5-formaat) en deelknop via WhatsApp
- Excel-kostenoverzicht per week, afgestemd op klantenformat
- Beheerportaal: CRUD stamdata, CSV-import medewerkers, Excel-export
- Progressive Web App (PWA) — offline ondersteuning via IndexedDB

---

## Tech Stack

| Laag       | Technologie                              |
|------------|------------------------------------------|
| Frontend   | React (Vite), Tailwind CSS, Framer Motion, vite-plugin-pwa |
| Backend    | Node.js, Express.js (Clean Architecture) |
| Database   | MySQL                                    |
| Auth       | JSON Web Tokens (JWT), bcryptjs           |
| Export     | PDFKit, ExcelJS                          |
| Logging    | Winston, Morgan                          |

---

## Mapstructuur

```
CalamiteitenApp_TranspoNuth/
├── backend/
│   ├── database/           # DDL: init.sql
│   ├── src/
│   │   ├── domain/         # Entiteiten & calculators (CROW, Strukton)
│   │   ├── usecases/       # Applicatielogica
│   │   ├── controllers/    # Express route-handlers
│   │   ├── infrastructure/ # DB-repositories, PDF/Excel-generatoren, logging
│   │   └── middleware/     # Auth (JWT), foutafhandeling, uploads
│   ├── uploads/            # Geüploade calamiteitsfoto's (lokaal, niet in git)
│   └── logs/               # Applicatie- en foutlogs (lokaal, niet in git)
├── frontend/
│   ├── public/             # Statische assets en PWA-manifest
│   └── src/
│       ├── components/     # Herbruikbare UI-componenten
│       ├── context/        # AuthContext (JWT-state)
│       ├── hooks/          # useAutosave, useSyncManager
│       ├── pages/          # Wizard, Admin-dashboard, Stamdata
│       ├── router/         # Beschermde routes (RBAC)
│       └── utils/          # apiClient, IndexedDB-helper
└── logs/                   # Root-niveau applicatielogs
```

---

## Installatie & Opstarten

### Vereisten
- Node.js ≥ 18
- MySQL 8 (bijv. via MAMP of een lokale installatie)

### Backend

```bash
cd backend
cp .env.example .env          # Vul database- en JWT-gegevens in
npm install
```

Initialiseer de database (eenmalig):

```bash
mysql -u root -p < database/init.sql
```

Optioneel: testgebruikers aanmaken:

```bash
node seedTestGebruikers.js
```

Server starten:

```bash
npm run dev
```

De API draait standaard op `http://localhost:3001`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

De applicatie draait standaard op `http://localhost:5173`.

---

## Omgevingsvariabelen (backend/.env)

Kopieer `.env.example` naar `.env` en vul de volgende waarden in:

| Variabele        | Omschrijving                        |
|------------------|-------------------------------------|
| `PORT`           | Poort waarop de API luistert (3001) |
| `DB_HOST`        | MySQL host (bijv. 127.0.0.1)        |
| `DB_PORT`        | MySQL poort (bijv. 3306 of 8889)    |
| `DB_GEBRUIKER`   | MySQL gebruikersnaam                |
| `DB_WACHTWOORD`  | MySQL wachtwoord                    |
| `DB_NAAM`        | Databasenaam (calamiteiten_db)      |
| `JWT_SECRET`     | Geheime sleutel voor JWT-tokens     |
| `JWT_VERLOOPT_IN`| Token levensduur (bijv. 8h)         |

---

## Gebruikersrollen

| Rol          | Toegang                                          |
|--------------|--------------------------------------------------|
| `Admin`      | Volledig beheerdersportaal, export, stamdata CRUD |
| `Medewerker` | Wizard (registratie), eigen calamiteiten bekijken |

---

## Licentie

Intern project — Transpo-Nuth BV. Niet bedoeld voor publieke distributie.
