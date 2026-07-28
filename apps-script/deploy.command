#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
PROJECT_DIR=${SCRIPT_DIR:h}
DEPLOYMENT_ID='AKfycbzXGwwZqhBFhVkdWnY84sz4YAc-iTSqShHS9PDfTaNq6uDQF-geMDTpUk4zptzNLnHarQ'
DESCRIPTION=${1:-"Words — автоматическое обновление"}

cd "$PROJECT_DIR"
node --test tests/*.test.js
node --check < apps-script/Code.gs

cd "$SCRIPT_DIR"
npx --yes @google/clasp push

VERSION_OUTPUT=$(npx --yes @google/clasp version "$DESCRIPTION")
print -r -- "$VERSION_OUTPUT"
VERSION_NUMBER=$(print -r -- "$VERSION_OUTPUT" | sed -nE 's/.*version ([0-9]+).*/\1/p' | tail -1)

if [[ -z "$VERSION_NUMBER" ]]; then
  print -u2 'Не удалось определить номер созданной версии.'
  exit 1
fi

npx --yes @google/clasp redeploy "$DEPLOYMENT_ID" \
  --versionNumber "$VERSION_NUMBER" \
  --description "$DESCRIPTION"

print -r -- "Готово: версия $VERSION_NUMBER опубликована без изменения URL."
