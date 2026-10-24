# Abschlussbericht – erste Version (v0.1)

## Umgesetzt
- Lokale deutsche Oberfläche: Produktliste mit Suche, Filtern (Status, Gruppe, Exportfähigkeit, nur unvollständige) und Auswahlkästchen; Detailansicht mit Bildvorschau (externe Bilder erst nach Klick, Beispielbilder lokal), Variante, konkreter Verkaufseinheit; Status Kandidat/Prüfung nötig/freigegeben/ausgeschlossen (Ausschlussgrund Pflicht); sichtbare fehlende Angaben; drei getrennte Freigaben (Daten, Preis, Export) mit „veraltet“-Erkennung; „Was muss ich als Nächstes tun?“ global und je Produkt.
- Datenmodell nach Vorgabe, Unbekanntes bleibt `null`; Import/Export JSON/CSV mit Vorschau, Fehlerliste, ohne stilles Überschreiben, automatischer Sicherung; Freigaben aus Dateien standardmäßig verworfen.
- Preisrechnung mit BigInt-Dezimalarithmetik: Netto→Brutto (bestätigter Preis) und getrennt davon optionaler Preisvorschlag (Marge vs. Aufschlag, Steuer, Paketmenge, Einkauf, Veredelung, anteilige Einrichtung, Verpackung, Handling, Versandzuschuss, Gebühren mit Basis Netto/Brutto/Festbetrag je Bestellung); fehlende Grundlagen blockieren; Rechenweg und Rundungsregel werden angezeigt; Vorschlag wird nur als unbestätigter Entwurf übernommen.
- Vertraulicher Kalkulationsbereich, getrennt gespeichert (nur Testwerte), nicht in Exporten/Berichten/Logs.
- Getrennte Exportadapter Meta und TikTok als gekennzeichnete Gerüste (interne Vorschau), Sperren für unbestätigte Preise, Anfrageartikel, unvollständige Konfiguration, Landingpage-Abweichung; Liste der fehlenden Originalvorlagen/Pflichtfelder.
- Prüfbericht je Produkt; 11 synthetische Beispiele; Dokumentation (Start, Datenformat, Übergabe, offene Vorlagen).
- Sicherheit: Darstellung nur per `textContent`, nur http(s)-Links, CSV-Formelschutz, CSP, Server nur auf 127.0.0.1, nur GET, Host-/Pfadprüfung, keine ausgehenden Aufrufe.

## Tatsächlich getestet
- `npm test`: 40 automatische Tests bestanden (Dezimalrechnung, Rundung, Marge/Aufschlag, Steuer 19/7/0 %, Gebühren je Basis, Paketmenge, Einrichtung, fehlende Grundlagen, Varianten, Mindestmengen, fehlende Pflichtfelder, Freigaben/Veralten, Exportsperren, CSV-Sicherheit und Roundtrip, Importfehler, Prototype-Pollution, Server-Pfad/Host, keine Kalkulationsfelder im Export, keine `console.*`).
- Browser-Test mit Chromium (Playwright) unter Linux: Beispieldaten importieren, Liste, Detail, Freigaben, Kalkulation, Export-Vorschau, Bericht, Neuladen – ohne Konsolenfehler.

## Nachtrag (Amazon, Empfehlungen, Vorlagenbefüllung)
Amazon-Adapter (Gerüst, Sperre ohne GTIN/Marke), Reiter „Empfehlungen“ (nur Vorbereitungsstand) und CSV-Vorlagenbefüllung sind ergänzt, siehe `docs/ROADMAP.md`. Excel-Vorlagen sind nicht unterstützt.

## Nachtrag 2 (Übergabedatei 24.10.2026)
Preislogik an das Übergabedokument angepasst (Definition von Marge/Aufschlag **geändert**), neue Pflichtfelder und Sperren (Veralterung, Lebensmittel/Kühlung, Bestand, Logistik, Druckkonfiguration, ASIN), Herkunftsnachweis + Plattform-Checkliste vor dem Befüllen von Vorlagen. Details: `docs/LUECKENBERICHT.md`.

## Nicht getestet / offen
- Nicht auf Windows und macOS ausgeführt (Startskripte nur geschrieben; Linux-Test). Download-Buttons wurden nicht im Browser ausgelöst (Inhalte per Unit-Test geprüft).
- Keine Echtdaten, keine echten Römer-/Rominox-Produkte; keine Prüfung gegen echte Plattformvorlagen, daher keine Importfähigkeit behauptet.
- Keine Prüfung von Landingpages (Felder werden manuell erfasst); Alkohol-/Lebensmittelregeln der Plattformen ungeprüft.
- Rundungsentscheidungen (Netto-Vorschlag aufrunden, Brutto kaufmännisch) bitte fachlich bestätigen; Preisendungen wie .99 nicht umgesetzt.
- Browser-Speicher ist pro Browser/Rechner; kein Mehrbenutzerbetrieb.

## Benötigte echte Eingaben
1. Echte Produktdaten aus dem Bot-/Preisdatenbank-Projekt im Format aus `docs/DATENFORMAT.md` (inkl. bestätigter Preise, Steuersätze, Verkaufseinheit/Paketinhalt/Mindestmenge, Veredelungskonfiguration).
2. Bildrechte-Nachweise, Lebensmittel-/Alkohol-/Sicherheitsangaben.
3. Verfügbarkeitsbelege, Versandregeln, Lieferzeiten, Landingpage-URLs.
4. Aktuelle deutsche Meta- und TikTok-Shop-Originalvorlagen je Kategorie (siehe `docs/EXPORT-OFFEN.md`).
5. Für Preisvorschläge: echte Kostengrundlagen und Gebührenmodelle (bisher nur Testwerte).
6. Entscheidung, welche Römer-Präsentsets und Rominox-Artikel die erste Auswahl bilden (Freigabe zur Veröffentlichung folgt erst danach).
