import argparse
import json
import os
import sys

from config import JSON_FILE, SQL_FILE
from generator import Generator


def run_strava_sync_recent(client_id, client_secret, refresh_token, days=7, only_run=False):
    generator = Generator(SQL_FILE)
    generator.set_strava_config(client_id, client_secret, refresh_token)
    generator.only_run = only_run
    generator.sync_recent(days=days)

    activities_list = generator.loadForMapping()
    with open(JSON_FILE, "w") as f:
        json.dump(activities_list, f, indent=0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sync recent Strava activities (default: last 7 days). "
                    "Credentials can be provided via env vars: "
                    "STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN."
    )
    parser.add_argument("client_id", nargs="?", help="Strava client ID (or set STRAVA_CLIENT_ID)")
    parser.add_argument("client_secret", nargs="?", help="Strava client secret (or set STRAVA_CLIENT_SECRET)")
    parser.add_argument("refresh_token", nargs="?", help="Strava refresh token (or set STRAVA_REFRESH_TOKEN)")
    parser.add_argument(
        "--days",
        type=int,
        default=int(os.getenv("STRAVA_SYNC_DAYS", "7")),
        help="number of days to look back (default: 7, or set STRAVA_SYNC_DAYS)",
    )
    parser.add_argument(
        "--only-run",
        dest="only_run",
        action="store_true",
        default=os.getenv("STRAVA_ONLY_RUN", "").lower() in ("1", "true", "yes"),
        help="only sync running activities (or set STRAVA_ONLY_RUN=true)",
    )
    options = parser.parse_args()

    # Resolve credentials: CLI args take priority, then env vars
    client_id = options.client_id or os.getenv("STRAVA_CLIENT_ID")
    client_secret = options.client_secret or os.getenv("STRAVA_CLIENT_SECRET")
    refresh_token = options.refresh_token or os.getenv("STRAVA_REFRESH_TOKEN")

    missing = [name for name, val in [
        ("client_id / STRAVA_CLIENT_ID", client_id),
        ("client_secret / STRAVA_CLIENT_SECRET", client_secret),
        ("refresh_token / STRAVA_REFRESH_TOKEN", refresh_token),
    ] if not val]

    if missing:
        parser.error("Missing required credentials: " + ", ".join(missing))
        sys.exit(1)

    run_strava_sync_recent(
        client_id,
        client_secret,
        refresh_token,
        days=options.days,
        only_run=options.only_run,
    )
