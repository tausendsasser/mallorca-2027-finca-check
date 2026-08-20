# Datenpflege: Mallorca 2027 – Finca Check

Die App liest beim Start ausschließlich `data/fincas.json`. Eine neue oder geänderte Finca benötigt keine Änderung an HTML, CSS oder JavaScript.

## Aufbau der Datei

- `schemaVersion`: Version des Datenmodells.
- `lastUpdated`: Datum der letzten inhaltlichen Änderung im Format `YYYY-MM-DD`.
- `trip`: globales Urlaubsfenster, Idealzeitraum, Personenzahl und Reisedauer.
- `familyMembers`: Personen, die Bewertungen abgeben dürfen.
- `ratingCriteria`: Kriterien, Gewichtungen und Muss-Kriterien.
- `ratingRules.mustCriteriaScoreCap`: maximale Gesamtwertung, falls ein Muss-Kriterium die Schwelle unterschreitet.
- `fincas`: Liste aller Unterkünfte.

## Pflichtfelder pro Finca

Mindestens erforderlich sind:

- `id`: eindeutiger, dauerhafter Bezeichner in Kleinbuchstaben, z. B. `finca-sonnenhof`.
- `name`
- `status`: `candidate`, `active` oder `excluded`.
- `provider`
- `listingUrl`
- `location`, `region`, `islandArea`
- `price`, `currency`, `nights`, `adults`, `children`
- `availability.intervals`
- `images` (darf leer sein)
- `familyRatings` (darf leer sein)

Alle übrigen Felder bleiben im Datensatz vorhanden und erhalten bei unbekannten Angaben `null`, `"unknown"`, `[]` oder `{}` passend zum Feldtyp. Keine Felder entfernen, nur weil Daten fehlen.

## Status

- `candidate`: neu vorgeschlagen, noch nicht vollständig geprüft.
- `active`: geprüft und Bestandteil des laufenden Vergleichs.
- `excluded`: bewusst ausgeschlossen. Der Datensatz bleibt erhalten, damit dieselbe Unterkunft nicht später versehentlich erneut aufgenommen wird.

## Beispiel einer neuen Finca

```json
{
  "id": "beispiel-finca",
  "name": "Beispiel Finca",
  "status": "candidate",
  "provider": "Airbnb",
  "listingUrl": "https://example.com/inserat",
  "location": "Artà",
  "region": "Nordost",
  "islandArea": "Nordost",
  "price": null,
  "currency": "EUR",
  "nights": 14,
  "adults": 4,
  "children": 2,
  "bedrooms": null,
  "bathrooms": null,
  "beds": null,
  "bedConfiguration": "unknown",
  "pool": {
    "length": null,
    "width": null,
    "area": null,
    "display": "Maße unbekannt",
    "minDepth": null,
    "maxDepth": null,
    "saltwater": null,
    "jumpingAssessment": "unknown"
  },
  "airConditioning": "unknown",
  "washingMachine": "unknown",
  "privacy": "unknown",
  "neighbours": "unknown",
  "roadNoise": "unknown",
  "outdoorArea": "unknown",
  "coveredTerrace": "unknown",
  "kitchenToTerrace": "unknown",
  "terraceToPool": "unknown",
  "poolVisibility": "unknown",
  "outdoorKitchen": "unknown",
  "barbecue": "unknown",
  "beachDistance": null,
  "townDistance": null,
  "restaurantDistance": null,
  "externalRating": null,
  "reviewCount": null,
  "reviewPositives": [],
  "reviewNegatives": [],
  "personalPositives": [],
  "personalNegatives": [],
  "memoryAnchor": null,
  "availability": {
    "summary": "Noch nicht geprüft",
    "intervals": [
      { "start": "2027-07-24", "end": "2027-08-15", "state": "unknown" }
    ]
  },
  "images": [],
  "familyRatings": {}
}
```

## Verfügbarkeit aktualisieren

Jedes Intervall besitzt `start`, `end` und `state`. Erlaubte Zustände sind `available`, `unavailable` und `unknown`. Intervalle dürfen sich nicht widersprechen. Die App erzeugt daraus den Balken für das globale Urlaubsfenster.

```json
"intervals": [
  { "start": "2027-07-24", "end": "2027-07-25", "state": "unavailable" },
  { "start": "2027-07-26", "end": "2027-08-15", "state": "available" }
]
```

## Bewertungen ergänzen

Die Schlüssel unter `familyRatings` müssen aus `familyMembers` stammen. Werte liegen auf einer Skala von 1 bis 10. Einzelne noch fehlende Bewertungen dürfen `null` sein.

```json
"familyRatings": {
  "Marcel": {
    "scores": {
      "sleeping": 8,
      "privacy": 9,
      "socialPool": 8,
      "pool": 9,
      "region": 9,
      "outdoor": 8,
      "climate": 7,
      "value": 8,
      "gutFeeling": 9
    },
    "comment": "Sehr stimmiges Gesamtpaket.",
    "dealbreaker": null,
    "favorite": true
  }
}
```

Die App berechnet die gewichtete Wertung aus `ratingCriteria`. Liegt `sleeping` oder `privacy` unter 5, wird die Gesamtwertung gemäß `mustCriteriaScoreCap` gedeckelt.

## Sicherer Update-Ablauf für einen KI-Agenten

1. `data/fincas.json` lesen und nach identischer `listingUrl` sowie ähnlichem Namen suchen.
2. Bei einem Treffer den bestehenden Datensatz aktualisieren; keinen zweiten Datensatz erzeugen.
3. Bei einer ausgeschlossenen Finca den Ausschluss respektieren und nur auf ausdrücklichen Wunsch ändern.
4. Bei einer neuen Finca das Beispiel vollständig kopieren, eine eindeutige `id` vergeben und recherchierte Felder ergänzen.
5. JSON-Syntax prüfen und sicherstellen, dass alle IDs eindeutig sind.
6. Nur `data/fincas.json` ändern, sofern keine neue Frontend-Funktion angefordert wurde.
7. Änderung committen und auf den GitHub-Pages-Branch veröffentlichen. GitHub Pages aktualisiert die App anschließend automatisch.
