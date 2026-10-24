# Übergabe an das Bot-/Preisdatenbank-Projekt

Dieses Dokument beschreibt, welche Daten der Assistent erwartet. **Es sind keine Änderungen an der API oder Datenbank des anderen Projekts nötig**: Es genügt eine Datei (JSON oder CSV) im Format aus [DATENFORMAT.md](DATENFORMAT.md), z. B. als Export/Abzug, der in „Daten → Importieren“ geladen wird. Der Assistent ruft keine API auf.

## Benötigte Felder je Angebot (Verkaufseinheit)
Pflicht für Produktdaten-Freigabe: `id` (stabil, eine ID je Variante und Verkaufseinheit), `sku`, `family`, `variant.label`, `title`, `description`, `productUrl`, `imageUrls`, `imageRights.status`+`evidence` (nur wenn tatsächlich geklärt), `sale.unit`, `sale.packSize`, `sale.minOrderQty`, `finishing.required` (+ `offeredConfig`, `configComplete` bei Pflicht), `source.name`, `source.updatedAt`, `flags.food`, `flags.alcohol`, `compliance.status`.
Für Preis: `price.net`, `price.taxRate`, `price.gross`, `price.currency`, `price.origin = "database"`, `price.confirmed = "yes"` nur für wirklich bestätigte Preise; Preis **je Verkaufseinheit**.
Für Export: `inquiryOnly`, `shipping.rule`, `shipping.deliveryTime`, `availability.status/evidence/asOf`. Landingpage-Felder (`landing.*`) werden im Assistenten nach Prüfung der echten Seite erfasst.

## Wichtig
- Unbekanntes leer/`null` lassen – nicht schätzen. Keine GTINs, Bestände, Rechte oder Nachweise erfinden.
- `availability.status = "supplier_available"` nur für Lieferantenverfügbarkeit; `own_stock` nur bei belegtem eigenem Bestand.
- **Keine** Einkaufspreise, Margen, Gebühren oder Kalkulationswerte in die Datei schreiben (unbekannte Felder werden ignoriert, aber der Austausch soll sie nicht enthalten).
- Freigaben (`approvals`) nicht mitliefern; sie werden beim Import verworfen. Freigaben erteilen Personen im Assistenten.
- Geldwerte als Zeichenketten mit Punkt (`"19.90"`), Steuersatz in Prozent (`"19"`). Brutto = Netto × (1 + Satz/100), kaufmännisch auf Cent gerundet – abweichende Werte werden als Widerspruch markiert.
- IDs müssen über Läufe hinweg stabil bleiben; bei erneutem Import erscheinen Änderungen als „abweichend“ und werden nur nach Auswahl übernommen.
- Optional `synthetic: true` nur für Testdaten; echte Daten ohne dieses Feld.
