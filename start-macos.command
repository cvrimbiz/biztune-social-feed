#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js wurde nicht gefunden. Bitte Node.js ab Version 20 von https://nodejs.org installieren."
  read -r -p "Zum Beenden Enter drücken." _
  exit 1
fi
node server.mjs --open
