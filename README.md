# Immobilien-Kalkulator

Bestandshaltungs-Kalkulationstool für Immobilien in Deutschland.

## Features

- **Exposé-Upload**: PDF hochladen → AI extrahiert automatisch alle Daten
- **Vollständige Kalkulation**: Rendite, Cashflow, Steuern, Finanzierung, 30-Jahres-Verlauf
- **Kaufpreis-Analyse**: Zielkaufpreise bei 5% und 6% Rendite
- **Objekt-Verwaltung**: Mehrere Immobilien speichern und vergleichen
- **Dark Mode**: Automatische Anpassung

## Deployment auf Vercel

### Option 1: Über GitHub

```bash
# 1. Repo erstellen und Code pushen
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/DEIN-USER/immo-kalkulator.git
git push -u origin main

# 2. Auf vercel.com → "Import Project" → GitHub Repo auswählen
# 3. Environment Variable setzen: ANTHROPIC_API_KEY = sk-ant-...
# 4. Deploy klicken
```

### Option 2: Vercel CLI

```bash
# 1. Vercel CLI installieren
npm i -g vercel

# 2. Deployen
vercel

# 3. API Key setzen
vercel env add ANTHROPIC_API_KEY
# → Wert eingeben: sk-ant-...

# 4. Erneut deployen
vercel --prod
```

### Option 3: Claude Code

```bash
# 1. In das Projektverzeichnis wechseln
cd immo-kalkulator

# 2. Dependencies installieren
npm install

# 3. Vercel CLI nutzen
npx vercel --prod

# 4. API Key über Vercel Dashboard oder CLI setzen
npx vercel env add ANTHROPIC_API_KEY
```

## Lokal entwickeln

```bash
npm install
cp .env.example .env.local
# → ANTHROPIC_API_KEY in .env.local eintragen
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000)

## Umgebungsvariablen

| Variable | Beschreibung | Erforderlich |
|----------|-------------|-------------|
| `ANTHROPIC_API_KEY` | Claude API Key für PDF-Extraktion | Nur für Exposé-Upload |
