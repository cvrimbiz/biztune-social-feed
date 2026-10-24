# Arbeitsablauf und nächste Schritte

## Geplanter Ablauf (Ziel)
1. Produktdaten aus dem Bot-/Preisdatenbank-Projekt importieren (Format: `DATENFORMAT.md`).
2. Reiter **Empfehlungen**: pro Plattform (Meta, TikTok, Amazon) sehen, welche Produkte am weitesten vorbereitet sind; Auswahl treffen.
3. Fehlende Angaben ergänzen, drei Freigaben erteilen.
4. Pro Plattform die **aktuelle Originalvorlage selbst herunterladen** (eigenes Konto, Login macht nur die Person), im Reiter **Export** laden, Zuordnung bestätigen → befüllte Vorlage herunterladen.
5. Befüllte Datei von Hand bei der Plattform hochladen (Bilder: nur als Link in der Vorlage, falls die Plattform das erlaubt; sonst separat hochladen). Der Assistent lädt nichts hoch und verbindet keine Konten.

## Stand
| Baustein | Stand |
|---|---|
| Meta-, TikTok-, Amazon-Adapter | Gerüste, nicht gegen Originalvorlagen validiert |
| Vorlagen befüllen (CSV) | funktioniert mit beliebiger CSV-Vorlage + bestätigter Spaltenzuordnung; Vorschau-Kennzeichnung bleibt, bis eine echte Vorlage erfolgreich geprüft wurde |
| Excel-Vorlagen (.xlsx/.xlsm) | **nicht** unterstützt (bräuchte eine Bibliothek und eine echte Beispieldatei; Amazon-Vorlagen haben Hinweisblätter, Auswahllisten, Makros) |
| Empfehlungen | nur Vorbereitungsstand, keine Nachfrage-/Verkaufsdaten |

## Dafür werden echte Eingaben benötigt
- Je Plattform eine aktuelle, leere Originalvorlage je Kategorie (am besten zusätzlich eine bereits erfolgreich importierte Beispielzeile).
- Amazon: Inventar-/Angebotsbericht und Verkaufsbericht (Business Report) als CSV aus dem Konto → damit können bisherige Bestseller und bestehende ASINs in die Empfehlung einfließen; Angaben zu Marke/GTIN-Befreiung.
- Meta/TikTok: Klärung, ob Checkout auf der eigenen Website oder auf der Plattform stattfindet.

## Separates Tool (später): Videos und Posts
Kurze Videos/Story-Highlights aus Produktdaten sollten ein eigenes Tool werden, das nur Daten dieser Arbeitsliste liest (Titel, Bilder mit bestätigten Bildrechten, **bestätigter** Preis). Erst entscheiden: Werkzeug (z. B. lokale Videoerzeugung), Vorlagen/Corporate Design, Musik-/Bildrechte. Nicht Teil dieses Repositories in v0.1.
