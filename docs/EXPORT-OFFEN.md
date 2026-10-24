# Plattformexport: was noch fehlt

Die Adapter `public/js/exporters/meta.mjs` und `tiktok.mjs` sind **Gerüste**: Spaltennamen sind interne Namen, **kein** Zielschema ist validiert, keine US-Vorlage wurde übernommen. Jede Ausgabe ist als „INTERNE VORSCHAU – NICHT FÜR PLATTFORM-IMPORT“ gekennzeichnet (Banner, Spalte `_interne_vorschau`, Dateiname `VORSCHAU-INTERN…`). Importfähigkeit ist nicht geprüft und wird nicht behauptet.

## Benötigte Originalvorlagen / Unterlagen
**Meta (Instagram/Facebook-Katalog)**
1. Aktuelle deutsche Original-Katalogvorlage je betroffener Produktkategorie.
2. Pflicht-/optionale Felder je Kategorie mit deutschen Spaltenköpfen und erlaubten Werten.
3. Preisformat (Währungsangabe, brutto/netto), Umgang mit Mindestmengen/Paketeinheiten.
4. Regel zur Verknüpfung von Varianten/Produktgruppen.
5. Pflicht von GTIN/MPN/Marke je Kategorie (interne GTINs bleiben leer, solange nicht belegt).
6. Bild- und Textvorgaben (Format, Größe, Zeichenlimits).
7. Richtlinien für Lebensmittel/Alkohol im Zielmarkt Deutschland.
8. Klärung des Kaufwegs (Checkout auf eigener Website oder Plattform) – bestimmt die Landingpage-Prüfung.

**TikTok Shop**
1. Aktuelle deutsche Original-Upload-Vorlage (Zielmarkt Deutschland) je Kategorie.
2. Kategoriebaum und kategoriespezifische Pflichtattribute.
3. Verbindliche Produkt-(SPU)/SKU-Struktur inkl. Variantenattribute.
4. Mindestbestellmenge/Verkaufseinheit (ist Paketverkauf abbildbar?), Preisangabe brutto/netto.
5. Pflichtangaben zu Produktsicherheit/Verantwortlichen im EU-Markt, Lebensmittel/Alkohol.
6. Bestandsangabe: wird eine Stückzahl verlangt? (Lieferantenverfügbarkeit ≠ eigener Bestand – Vorgehen klären.)
7. Gewicht/Maße, Versand-/Logistikvorlage, Rückgaberegeln.
8. Bild- und Textvorgaben.

**Amazon (Marketplace, eigenes Händlerkonto)**
1. Aktuelle Original-Vorlage(n) für amazon.de aus Seller Central je Kategorie/Produkttyp.
2. Bereits vorhandene ASINs/Angebote (Inventarbericht), damit neue Produktseiten und Angebote zu bestehenden ASINs unterschieden werden können.
3. Marken- und GTIN-Regeln inkl. möglicher GTIN-Befreiung; Markenfreigaben.
4. Pflichtfelder je Produkttyp (Merkmale/Bullet Points, Suchbegriffe, Gewicht/Maße, Herkunftsland, Sicherheitsangaben).
5. Variantenstruktur (Eltern/Kind), Versandmodell (Händlerversand/FBA), Bestandsangabe (Lieferantenverfügbarkeit ≠ Bestand).
6. Bildvorgaben, beschränkte Kategorien, Lebensmittel-/Alkoholregeln.
Zusätzliche Amazon-Sperre im Adapter: ohne GTIN oder Marke wird nichts exportiert (es wird nichts erfunden).

## Bisher unbekannte Pflichtfelder (in der App unter „Export“ aufgelistet)
Meta: Plattformkategorie, Marke, Zustand, Versandgewicht/-maße, Rückgabe-/Versandrichtlinien, verbindliche Spaltennamen.
TikTok: Kategorie-ID, Marke, Gewicht/Maße, Versandvorlage, Bestandsmenge, verbindliche Spaltennamen.

## Sperren vor jedem Export (umgesetzt)
Nur Produkte mit gültigen Freigaben für Daten, Preis **und** Export; kein Anfrageartikel; bestätigter Preis; vollständige Pflichtkonfiguration; Verfügbarkeit mit Beleg; Landingpage-Prüfung mit übereinstimmender Variante, Menge und Preis; keine Kalkulationsfelder (Spalten-Positivliste, per Test geprüft). Lieferantenverfügbarkeit wird als „Lieferantenverfügbarkeit – kein eigener Bestand“ ausgewiesen, nie als „auf Lager“.
