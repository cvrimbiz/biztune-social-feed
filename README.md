# BizTune Social-Produktassistent

Schlanker, lokaler Assistent zur Vorbereitung von Instagram-/Meta- und TikTok-Shop-Angeboten.
**Prototyp (v0.1) mit ausschließlich synthetischen Beispieldaten** – es wurden keine echten Römer- oder Rominox-Produkte importiert.

- Vanilla-JavaScript im Browser, ein winziger Node-Server ohne Abhängigkeiten (`server.mjs`), keine Anmeldung, kein Backend, keine externen Dienste/KI-Aufrufe.
- Daten liegen lokal im Browser (localStorage); Import/Export der Arbeitsliste als JSON/CSV.
- Es werden keine Konten verbunden, nichts veröffentlicht, keine produktiven APIs aufgerufen. Website und Preisdatenbank werden nicht berührt.

## Start
Siehe [docs/START.md](docs/START.md) (Windows und macOS). Kurz: Node.js ≥ 20 installieren, dann `start-windows.bat` bzw. `start-macos.command` doppelklicken oder `npm start`. Tests: `npm test`.

## Aufbau
| Pfad | Inhalt |
|---|---|
| `public/js/decimal.mjs` | BigInt-Dezimalarithmetik (keine Floats für Geld) |
| `public/js/pricing.mjs` | Netto→Brutto, Preisvorschlag (Marge/Aufschlag, Gebühren) |
| `public/js/schema.mjs` | Datenmodell, Feldprüfung (unbekannt = `null`) |
| `public/js/rules.mjs` | fehlende Angaben, getrennte Freigaben, Exportsperren, nächste Schritte |
| `public/js/io.mjs`, `csv.mjs` | Import/Export JSON/CSV, CSV-Formelschutz, kein stilles Überschreiben |
| `public/js/exporters/` | getrennte Adaptergerüste Meta / TikTok (interne Vorschau) |
| `public/js/report.mjs` | produktbezogener Prüfbericht |
| `public/js/app.js`, `view-*.js` | Oberfläche (deutsch) |
| `data/` | synthetische Beispiele, Importbeispiele |
| `tests/` | Tests (`node --test`) |

## Dokumente
- [Startanleitung](docs/START.md)
- [Internes Datenformat](docs/DATENFORMAT.md)
- [Fehlende Originalvorlagen / Plattform-Pflichtfelder](docs/EXPORT-OFFEN.md)
- [Übergabe an das Bot-/Preisdatenbank-Projekt](docs/UEBERGABE-BOT-PREISDB.md)
- [Beispiel-Prüfbericht](docs/pruefbericht-beispiel.md) (synthetisch)
- [Abschlussbericht](docs/ABSCHLUSSBERICHT.md)
