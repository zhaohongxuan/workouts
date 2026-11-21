#!/usr/bin/env python3
"""Check the remaining validity of a Strava strava_remember_token (JWT).

Usage:
    python3 scripts/strava_jwt_check.py <jwt>            # paste the token
    python3 scripts/strava_jwt_check.py                  # read from stdin
    echo "$JWT" | python3 scripts/strava_jwt_check.py
    STRAVA_JWT=... python3 scripts/strava_jwt_check.py   # read from env

Prints the expiry date, days remaining, and whether the token has expired.
Exits 0 when valid, 1 when expired or undecodable.
"""

import base64
import datetime
import json
import os
import sys


def decode_jwt(jwt):
    """Return the payload dict of a JWT, or None if undecodable."""
    try:
        payload = jwt.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload))
    except Exception:
        return None


def days_left(jwt):
    """Return remaining days (float) for a JWT, or None if undecodable/no exp."""
    data = decode_jwt(jwt)
    if data is None or not data.get("exp"):
        return None
    now = datetime.datetime.now(datetime.timezone.utc).timestamp()
    return (data["exp"] - now) / 86400.0


def main():
    # --days-left: machine-readable mode, prints a single float (or nothing on error).
    machine_mode = "--days-left" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    jwt = None
    if args:
        jwt = args[0]
    elif "STRAVA_JWT" in os.environ:
        jwt = os.environ["STRAVA_JWT"]
    elif not sys.stdin.isatty():
        jwt = sys.stdin.read().strip()

    if not jwt:
        if machine_mode:
            return 2
        print("No JWT provided. Pass it as an argument, via stdin, or set STRAVA_JWT.", file=sys.stderr)
        return 2

    remaining = days_left(jwt)
    if remaining is None:
        if machine_mode:
            return 1
        print("ERROR: could not decode the JWT (is it a valid strava_remember_token?).", file=sys.stderr)
        return 1

    if machine_mode:
        print(f"{remaining:.1f}")
        return 0

    data = decode_jwt(jwt)
    exp = data["exp"]
    exp_dt = datetime.datetime.fromtimestamp(exp, datetime.timezone.utc)

    print(f"Subject (athlete id): {data.get('sub', '?')}")
    print(f"Issued at:            {datetime.datetime.fromtimestamp(data['iat'], datetime.timezone.utc).isoformat() if data.get('iat') else '?'}")
    print(f"Expires at:           {exp_dt.isoformat()}")
    print(f"Days remaining:       {remaining:.1f}")

    if remaining <= 0:
        print("STATUS: EXPIRED")
        return 1
    if remaining <= 7:
        print("STATUS: EXPIRING SOON (refresh recommended)")
    else:
        print("STATUS: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
