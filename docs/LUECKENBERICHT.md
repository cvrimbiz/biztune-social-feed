# Lückenbericht (Stand nach Einarbeitung der Übergabedatei vom 24.10.2026)

## Aus der Übergabedatei umgesetzt
| Punkt | Umsetzung |
|---|---|
| Amazon zusätzlich zu TikTok/Meta | Adaptergerüst `amazon.mjs`, gemeinsames Produktmodell, Sperre ohne GTIN/Marke, ASIN nur mit Identitätsnachweis |
| Keine Plattformvorlage erfinden, kein „uploadfertig“ | alle Ausgaben „Interne Vorschau“; Vorlage befüllen nur mit Herkunftsnachweis (Markt DE, Kategorie, Zweck, Datum, Herkunft, SHA-256 automatisch) und bestätigten Plattform-Voraussetzungen |
| Pflichtspalten sperren | Pflichtspalten der Vorlage markierbar; ohne Zuordnung/Wert wird das Produkt bzw. die Datei gesperrt |
| Konto-/Kategorie-/Kaufweg-Berechtigung | Checkliste je Plattform (alles „unbekannt“, bis bestätigt) |
| Preislogik laut Dokument | Marge/Aufschlag neu, Versandumsatz, Gebührenbasen, Einmalkosten nur mit Beleg verteilt, Quelle + Gültigkeit, kleinster Cent-Preis exakt geprüft |
| Veraltete Werte | Quelldaten, Verfügbarkeit, Landingpage-Prüfung sperren nach 30 Tagen (Annahme) |
| Datenvertrag | Stückliste, Gewicht/Maße, Lieferfähigkeit, reservierter Bestand mit Ort/SLA, Lebensmittelangaben je Bestandteil, Kühlpflicht, Druckkonfiguration für feste personalisierte Pakete |
| Alkohol/Kühlung/sensibel separat sperren | Prüfstatus „geprüft“ ist Voraussetzung der Daten-Freigabe |
| Freie B2B-Konfiguration = Anfrage | `inquiryOnly` sperrt jeden Export |
| Vertrauliches nicht ins Repo | nur synthetische Testwerte; Kalkulation getrennt, nie exportiert/geloggt (Test) |

## Bewusst NICHT umgesetzt / offen
- **Keine aktuelle Recherche** zu TikTok-, Meta- und Amazon-Regeln, Gebühren, Zulassungen (Übergabe verlangt sie, hier nicht durchgeführt; keine Quellen mit Abrufdatum vorhanden). Meta-Hilfeseiten erfordern teils Anmeldung.
- Keine Rechtsfreigabe für Lebensmittel (Registrierung, Rückgabe/Widerruf, Verpackungs-/EPR-Rollen, Grundpreisangabe): nur Pflichtfelder und Warnhinweise.
- Setbestand aus Komponenten und Produktionskapazität: nur als bestätigende Angabe (`capacityConfirmed`), keine Berechnung aus Einzelbeständen.
- Gemischte Steuersätze/abweichende Versandsteuer: werden gesperrt, nicht gerechnet. Grundpreisanzeige nicht geprüft.
- Amazon-Kosten (Verkaufsplan, Kategorieprovision mit Mindestgebühr, FBA, Werbung): im Modell nur als frei eingebbare Gebühren mit Basis; keine Beträge hinterlegt. Mindestgebühren je Artikel sind noch nicht modelliert.
- Excel-Vorlagen, SP-API, Veröffentlichung, Videos/Posts: nicht Teil dieses Stands.
- GitHub-Sichtbarkeit des Repositories nicht geprüft; es liegen ausschließlich synthetische Daten darin.

## Annahmen, die ihr bestätigen müsst
30 Tage Gültigkeit; Amazon: GTIN und Marke Pflicht (ohne belegte Ausnahme); Verfügbarkeit beim Lieferanten genügt für Export, wenn Lieferfähigkeit bestätigt ist; Marge/Aufschlag-Definition wie im Dokument (bitte gegen den lokalen Prüfer abgleichen).
