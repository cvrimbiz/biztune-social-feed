# Internes Datenformat der Arbeitsliste (Version 1)

JSON-Datei:
```json
{ "format": "biztune-social-worklist", "version": 1, "exportedAt": "…", "products": [ { … } ] }
```
(Alternativ eine reine Liste von Produkten.) CSV: eine Zeile je Produkt, Spaltenköpfe = Feldpfade unten (z. B. `sale.packSize`), Semikolon/Komma/Tab werden erkannt, Listen mit ` | ` getrennt.

**Regeln:** Unbekannt = `null`/leer. Nichts wird ergänzt oder geschätzt. Geldwerte und Prozentsätze sind **Zeichenketten** („19.90“; Komma wird beim Einlesen akzeptiert, Tausenderpunkte nicht). Ja/Nein-Felder sind `"yes"`, `"no"` oder `null` (unbekannt). Datum `JJJJ-MM-TT`. Links nur `http(s)`, ohne Zugangsdaten. Unbekannte Felder werden mit Warnung ignoriert. **Kalkulations-/Kostenfelder gehören nicht in dieses Format.**

| Pfad | Typ | Bedeutung |
|---|---|---|
| `id` | Text, `[A-Za-z0-9._:-]{1,64}` | stabile Artikel-/Angebots-ID (Pflicht, eindeutig; Variante = eigene ID) |
| `sku`, `gtin`, `brand` | Text | SKU; GTIN und Marke nur wenn belegt (GTIN-Prüfziffer wird geprüft) |
| `brandLine` | `roemer_praesentset`/`rominox`/`other` | Auswahlgruppe |
| `family`, `variant.label` | Text | Produktfamilie, konkrete Variante |
| `title`, `description` | Text | werden nur als Text dargestellt |
| `productUrl`, `imageUrls[]` | URL | Produkt-/Bildlinks (max. 10) |
| `imageRights.status` / `.evidence` | `confirmed`/`denied`/`null`; Text | bestätigter Bildrechtsstatus + Nachweis |
| `sale.components` | Text | feste Stückliste/Inhalt des Sets |
| `sale.unit`, `sale.packSize`, `sale.minOrderQty` | Text, ganze Zahl ≥1, ganze Zahl ≥1 | Verkaufseinheit, Stück je Einheit, Mindestbestellmenge **in Verkaufseinheiten** |
| `inquiryOnly` | yes/no | Anfrageartikel (nie exportierbar) |
| `finishing.required` / `.offeredConfig` / `.configComplete` | yes/no; Text; yes/no | Veredelungspflicht, konkret angebotene Konfiguration, vollständig? |
| `finishing.printPosition/printColors/printArea/artworkProcess`, `finishing.oneOffIncluded` | Text, yes/no | bei Pflichtveredelung: genaue Druckkonfiguration, Korrekturprozess, Einmalkosten im Preis enthalten? |
| `price.net`, `price.taxRate`, `price.gross`, `price.currency` | Dezimal-String (Steuer in %), ISO-Code | Preis **je Verkaufseinheit** |
| `price.origin`, `price.confirmed` | `database`/`proposal`; yes/no | Herkunft; in Preisdatenbank bestätigt |
| `shipping.rule`, `shipping.deliveryTime` | Text | Versandregel, Lieferzeit |
| `availability.status` / `.evidence` / `.asOf` | `own_stock`/`supplier_available`/`out_of_stock`/`on_request`; Text; Datum | belegter Verfügbarkeitsstand (Lieferant ≠ eigener Bestand) |
| `availability.reservedQty/location/sla` | ganze Zahl, Text, Text | nur bei `own_stock`: reservierter Bestand, Lagerort, Zusage |
| `availability.capacityConfirmed` | yes/no | Lieferfähigkeit (auch saisonal/Produktionskapazität) bestätigt |
| `logistics.weightGrams`, `logistics.dimensionsMm` | ganze Zahl, Text | Versandgewicht, Maße |
| `asin`, `asinProof` | 10 Zeichen, Text | ASIN nur mit Nachweis der Produktidentität; nie geraten |
| `landing.url`/`.checkedAt`/`.variant`/`.qty`/`.price` | … | Ergebnis der Prüfung der Landingpage: dort kaufbare Variante, Mindestmenge, Bruttopreis |
| `flags.food`, `flags.alcohol`, `flags.chilled` | yes/no | Kennzeichnung (Lebensmittel, Alkohol, Kühlpflicht) |
| `food.ingredients/allergens/netContent/nutrition/responsibleOperator/shelfLife/storage` | Text | Pflicht, wenn `flags.food = yes` (je Bestandteil) |
| `compliance.status` / `.notes` | `checked`/`not_required`/`null`; Text | Prüfstatus erforderlicher Produkt-/Sicherheitsangaben |
| `source.name`, `source.updatedAt` | Text, Datum | Quelle, Aktualisierungsdatum |
| `workflow.status` / `.exclusionReason` / `.note` | `candidate`/`review`/`approved`/`excluded`; Text | Arbeitsstand |
| `approvals.{data,price,export}.{approved,by,at,fingerprint}` | … | Freigaben; werden beim Import **standardmäßig verworfen** |
| `synthetic` | bool | Kennzeichnung synthetischer Beispiele |

## Prüfregeln (Kurz)
- **Produktdaten-Freigabe** erfordert u. a.: SKU, Familie, Variante, Titel, Beschreibung, Produktlink, Bild + bestätigte Bildrechte mit Nachweis, Verkaufseinheit/Paketinhalt/Mindestmenge, bekannte Veredelungspflicht (bei Pflicht: Konfiguration vollständig), Quelle+Datum, Lebensmittel-/Alkoholkennzeichnung, Prüfstatus (bei Lebensmittel/Alkohol „geprüft“).
- **Preis-Freigabe**: Netto > 0, Steuersatz, Brutto passend zu Netto×Steuer (kaufmännisch gerundet), Währung, Herkunft; Datenbankpreis nur wenn bestätigt.
- **Export-Freigabe**: Festpreis (kein Anfrageartikel), Versandregel, Lieferzeit, Verfügbarkeit mit Beleg/Stand (nicht „nicht verfügbar“/„auf Anfrage“), Landingpage geprüft **und** Variante, Mindestmenge, Bruttopreis stimmen überein; Daten- und Preisfreigabe gültig.
- Ändert sich ein freigaberelevantes Feld, wird die Freigabe **veraltet** (Prüfsumme). Status „freigegeben“ gilt nur bei drei gültigen Freigaben.

Beispiele: `data/sample-products.json` (synthetisch), `data/import-examples/` (minimal.json, minimal.csv, mit-fehlern.csv).

## Veraltete Daten
`source.updatedAt`, `availability.asOf` und `landing.checkedAt` älter als 30 Tage (einstellbar im Code: `config.maxAgeDays` in `rules.mjs`) sperren die Freigabe bzw. den Export. Der Wert 30 ist eine Annahme und muss von euch festgelegt werden.

## Kalkulation (nicht Teil der Arbeitsliste)
Liegt getrennt im Browser (`bt.costs.v1`), Testwerte in `data/sample-costs.json`. Formeln nach Übergabedokument (24.10.2026):
- `C = n × (Netto-Einstand + Netto-Druck je Stück) + Einmalkosten je Verkaufspaket + Netto-Verpackung + Netto-Handling + Netto-Versandkosten`. Einmalkosten werden nur bei belegter verbindlicher Abnahme auf mehrere Pakete verteilt.
- Netto-Erlös `R = (G + S) ÷ (1 + t)` (G Brutto-Artikelpreis, S Brutto-Versandumsatz, einheitliche bestätigte Steuer t; sonst Sperre).
- Aufschlag `u`: `R − F ≥ C × (1 + u)`. Marge `m`: `(R − F) × (1 − m) ≥ C`. Gesucht wird der **kleinste Netto-Cent-Preis**, der dies am gerundeten Brutto-Preis exakt erfüllt (geprüft; ein Cent weniger verletzt die Bedingung).
- Gebühren `F` sind linear; jede Gebühr hat eine ausdrückliche Basis (Brutto-Artikel, Brutto-Artikel+Versand, Netto-Artikel, Netto-Artikel+Versand, Festbetrag je Bestellung) und wird umgerechnet, nie schlicht addiert. Keine Gebühr wird unterstellt.
- Leer = unbekannt (blockiert), `"0"` = bekannt und kostenlos. Quelle und Gültigkeitsdatum der Kostenregel sind Pflicht; abgelaufene Regeln blockieren. Nenner ≤ 0, negative Werte, Kosten C = 0 blockieren.
- **Geänderte Definition gegenüber Version 0.1:** Marge/Aufschlag beziehen sich jetzt auf den Erlös nach Gebühren bzw. auf C (Gebühren werden vom Erlös abgezogen), nicht auf Kosten inkl. Gebühren.
