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
| `sku`, `gtin` | Text | SKU; GTIN nur wenn belegt (Prüfziffer wird geprüft) |
| `brandLine` | `roemer_praesentset`/`rominox`/`other` | Auswahlgruppe |
| `family`, `variant.label` | Text | Produktfamilie, konkrete Variante |
| `title`, `description` | Text | werden nur als Text dargestellt |
| `productUrl`, `imageUrls[]` | URL | Produkt-/Bildlinks (max. 10) |
| `imageRights.status` / `.evidence` | `confirmed`/`denied`/`null`; Text | bestätigter Bildrechtsstatus + Nachweis |
| `sale.unit`, `sale.packSize`, `sale.minOrderQty` | Text, ganze Zahl ≥1, ganze Zahl ≥1 | Verkaufseinheit, Stück je Einheit, Mindestbestellmenge **in Verkaufseinheiten** |
| `inquiryOnly` | yes/no | Anfrageartikel (nie exportierbar) |
| `finishing.required` / `.offeredConfig` / `.configComplete` | yes/no; Text; yes/no | Veredelungspflicht, konkret angebotene Konfiguration, vollständig? |
| `price.net`, `price.taxRate`, `price.gross`, `price.currency` | Dezimal-String (Steuer in %), ISO-Code | Preis **je Verkaufseinheit** |
| `price.origin`, `price.confirmed` | `database`/`proposal`; yes/no | Herkunft; in Preisdatenbank bestätigt |
| `shipping.rule`, `shipping.deliveryTime` | Text | Versandregel, Lieferzeit |
| `availability.status` / `.evidence` / `.asOf` | `own_stock`/`supplier_available`/`out_of_stock`/`on_request`; Text; Datum | belegter Verfügbarkeitsstand (Lieferant ≠ eigener Bestand) |
| `landing.url`/`.checkedAt`/`.variant`/`.qty`/`.price` | … | Ergebnis der Prüfung der Landingpage: dort kaufbare Variante, Mindestmenge, Bruttopreis |
| `flags.food`, `flags.alcohol` | yes/no | Kennzeichnung |
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

## Kalkulation (nicht Teil der Arbeitsliste)
Liegt getrennt im Browser (`bt.costs.v1`), Beispieltestwerte in `data/sample-costs.json`. Marge = Gewinn ÷ Netto-VK; Aufschlag = Gewinn ÷ Gesamtkosten inkl. Gebühren. Fehlende Kostenpositionen (leer) blockieren den Vorschlag, „0“ gilt als bekannt. Gebühren benötigen ausdrücklich eine Basis (Netto-VK, Brutto-VK oder Festbetrag je Bestellung).
