# Startanleitung

## Voraussetzung
[Node.js](https://nodejs.org) ab Version 20 (LTS) installieren. Weitere Pakete sind nicht nötig, es gibt keine Anmeldung und keine Internetverbindung für den Betrieb.

## Windows
1. Ordner entpacken/klonen.
2. `start-windows.bat` doppelklicken. Der Browser öffnet `http://127.0.0.1:5173/`.
3. Beenden: Fenster schließen oder Strg+C.

## macOS
1. Ordner entpacken/klonen.
2. `start-macos.command` doppelklicken. Beim ersten Mal ggf. Rechtsklick → „Öffnen“ bzw. im Terminal `chmod +x start-macos.command`.
3. Beenden: Terminalfenster schließen oder Strg+C.

Alternativ in beiden Systemen im Terminal: `npm start` (anderer Port: `PORT=5174 npm start`; Windows PowerShell: `$env:PORT=5174; npm start`).

## Erste Schritte
1. Reiter **Daten** → „Synthetische Beispieldaten laden“ → Vorschau prüfen → Importieren.
2. Reiter **Produkte**: Der Kasten „Was muss ich als Nächstes tun?“ nennt die nächsten Schritte; je Produkt gibt es einen eigenen „Nächster Schritt“.
3. Namen oben rechts eintragen, dann die drei Freigaben (Daten, Preis, Export) einzeln erteilen.
4. **Export** zeigt nur interne Vorschauen. **Prüfbericht** fasst alles je Produkt zusammen.

## Datensicherung
Daten liegen im Browser-Speicher dieses Rechners/Browsers. Regelmäßig unter **Daten** als JSON exportieren. Beim Import wird automatisch eine Sicherung angelegt (wiederherstellbar). Die vertrauliche Kalkulation liegt getrennt im Browser und wird nirgends exportiert.
