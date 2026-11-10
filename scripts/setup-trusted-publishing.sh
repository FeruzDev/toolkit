#!/usr/bin/env bash
# One-time setup: let GitHub Actions publish to npm WITHOUT tokens (npm Trusted Publishing).
# Needed before January 2027, when npm stops accepting 2FA-bypass tokens for publishing.
#
# Run it yourself (it changes npm account settings and npm may ask for a one-time code):
#   bash scripts/setup-trusted-publishing.sh
# After it succeeds you can delete the NPM_TOKEN secrets and the npm token itself.
set -u

trust() { # package repo workflow
  echo "→ $1  (FeruzDev/$2, $3)"
  npx -y npm@11 trust github "$1" --repo "FeruzDev/$2" --file "$3" --allow-publish -y || echo "   failed: $1"
}

# separate repos (release on version tag)
trust react-paginate-ts   react-paginate-ts release.yml
trust uz-translit         uz-translit       release.yml
trust react-rtsp-player   rtsp-player       release.yml
trust rtsp-player-server  rtsp-player       release.yml

# toolkit monorepo (publishes from ci.yml on push to main)
for p in use-live-announcer dotenv-validate cx-variants fetch-kit-ts duration-i18n tiny-uuidv7 temporal-dates \
         use-stale-data use-throttled-stream use-offline-actions use-idle-redirect use-visibility-polling \
         use-previous-diff use-typed-url-state use-keyboard-scope react-virtual-log react-column-resize \
         react-state-views use-optimistic-list; do
  trust "$p" toolkit ci.yml
done
