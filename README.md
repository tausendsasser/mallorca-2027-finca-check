# Mallorca 2027 – Finca Check

Eine mobile-first Vergleichs-App für die gemeinsame Finca-Suche der Familie. Sie läuft ohne Backend und ohne Build-Schritt direkt auf GitHub Pages.

## Architektur

- `index.html`: App-Struktur
- `styles.css`: mediterranes, responsives Design
- `app.js`: Rendering, Filter, Detailansicht, Vergleich und Teilen
- `data/fincas.json`: einzige Inhalts- und Konfigurationsquelle
- `docs/DATA-MAINTENANCE.md`: Pflegeanleitung für Menschen und KI-Agenten

Neue Fincas werden ausschließlich in `data/fincas.json` ergänzt. Details stehen in der Pflegeanleitung.

## Lokal ansehen

Da die App JSON per `fetch` lädt, muss sie über einen lokalen Webserver oder GitHub Pages geöffnet werden. Ein direktes Öffnen der HTML-Datei funktioniert in vielen Browsern nicht.

## GitHub Pages

Repository-Einstellungen öffnen, unter **Pages** als Quelle **Deploy from a branch** wählen und den Branch `main` mit Ordner `/ (root)` auswählen.
