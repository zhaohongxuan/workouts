#!/usr/bin/env bash
# Refresh the STRAVA_JWT GitHub Actions secret with a new strava_remember_token.
#
# Why: Strava's web "remember me" token (strava_remember_token) expires after
# ~30 days and cannot be auto-refreshed (login now uses an email one-time-code
# behind reCAPTCHA). This script makes the manual step as painless as possible:
# paste the new cookie value and it validates + uploads it to the repo secret.
#
# Prerequisites:
#   - GitHub CLI (`gh`) installed and authenticated (`gh auth login`).
#   - You have admin access to the repo (needed to write Actions secrets).
#
# Usage:
#   ./scripts/refresh_strava_jwt.sh              # paste token when prompted
#   ./scripts/refresh_strava_jwt.sh <JWT>        # pass token as argument
#   STRAVA_JWT=... ./scripts/refresh_strava_jwt.sh
#
# Env overrides:
#   REPO     - the "owner/repo" to update (default: zhaohongxuan/workouts)
#   SECRET   - the secret name (default: STRAVA_JWT)

set -euo pipefail

REPO="${REPO:-zhaohongxuan/workouts}"
SECRET="${SECRET:-STRAVA_JWT}"

# Resolve the token from: $1 arg -> STRAVA_JWT env -> stdin (non-tty) -> prompt
JWT="${1:-${STRAVA_JWT:-}}"
if [[ -z "$JWT" ]]; then
  if [[ ! -t 0 ]]; then
    JWT="$(cat)"
  else
    printf 'Paste the strava_remember_token value: '
    IFS= read -r JWT
  fi
fi

# Basic sanity: a JWT has three dot-separated segments.
if [[ "$JWT" != *.*.* ]] || [[ "$JWT" == *" "* ]]; then
  echo "ERROR: that does not look like a JWT (expected header.payload.signature)." >&2
  exit 1
fi

# Show remaining validity before uploading.
python3 scripts/strava_jwt_check.py "$JWT"
echo

echo "Uploading '$SECRET' to '$REPO' ..."
printf '%s' "$JWT" | gh secret set "$SECRET" --repo "$REPO"

echo "Done. The next scheduled sync run will pick up the new token."
