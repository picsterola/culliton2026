#!/usr/bin/env python3
"""
Refresh PDC fundraising totals for all 16 candidates.

Pulls live cash contribution totals from the Washington PDC's open-data
endpoint on data.wa.gov (Socrata dataset kv7h-kjye, "Contributions to
Candidates and Political Committees"). Sums all CASH contributions for
each candidate's filer_id in election_year=2026, then writes the result
into data/candidates.json under c['pdc']['raised'] and c['pdc']['as_of'].

Run weekly from the cron. Safe to run anytime — idempotent. Prints a
summary of what changed.

Usage:
    python3 scripts/refresh_pdc.py [--dry-run]

Exit code:
    0 — success (whether or not anything changed)
    1 — fatal error (network down, bad data, etc.)
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "data", "candidates.json")
SOCRATA_URL = "https://data.wa.gov/resource/kv7h-kjye.json"
USER_AGENT = "culliton2026-bot/1.0 (https://www.culliton2026.org)"
ELECTION_YEAR = "2026"
TIMEOUT = 20


def fetch_total(filer_id):
    """Return (cash_total: float or None, max_receipt_date: str or None) for a
    given filer. Sums all CASH contributions in 2026 election year. Excludes
    in-kind to match how PDC reports the "Raised" headline on candidate pages.
    """
    if not filer_id:
        return None, None
    # Socrata SoQL: escape single quotes by doubling
    fid_escaped = filer_id.replace("'", "''")
    params = {
        "$select": "sum(amount) AS total, max(receipt_date) AS latest",
        "$where": (
            f"filer_id='{fid_escaped}' "
            f"AND election_year='{ELECTION_YEAR}' "
            f"AND cash_or_in_kind='Cash'"
        ),
    }
    url = SOCRATA_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        rows = json.loads(r.read())
    if not rows or not rows[0]:
        return None, None
    row = rows[0]
    total_str = row.get("total")
    latest = row.get("latest")
    if total_str is None:
        return None, None
    try:
        total = float(total_str)
    except (TypeError, ValueError):
        return None, None
    if latest:
        # 2026-06-04T00:00:00.000 -> 2026-06-04
        latest = latest[:10]
    return total, latest


def main(dry_run=False):
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    changes = []
    errors = []

    for c in data["candidates"]:
        slug = c["slug"]
        pdc = c.setdefault("pdc", {})
        filer_id = pdc.get("filer_id")
        if not filer_id:
            continue
        try:
            total, latest = fetch_total(filer_id)
        except Exception as e:
            errors.append((slug, str(e)))
            continue

        old_raised = pdc.get("raised")
        old_as_of = pdc.get("as_of")
        new_raised = round(total, 2) if total is not None else None
        # Use latest contribution date as the as_of (matches what PDC shows)
        new_as_of = latest or date.today().isoformat()

        if (new_raised != old_raised) or (new_as_of != old_as_of):
            changes.append({
                "slug": slug,
                "name": c.get("name"),
                "old_raised": old_raised,
                "new_raised": new_raised,
                "old_as_of": old_as_of,
                "new_as_of": new_as_of,
            })
            pdc["raised"] = new_raised
            pdc["as_of"] = new_as_of

    if not dry_run and changes:
        data["updated"] = date.today().isoformat()
        with open(DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")

    # Summary
    print(f"PDC refresh: {len(changes)} candidate(s) updated, "
          f"{len(errors)} error(s){' [DRY RUN]' if dry_run else ''}")
    for ch in changes:
        old = f"${ch['old_raised']:,.0f}" if ch['old_raised'] is not None else "(unfiled)"
        new = f"${ch['new_raised']:,.0f}" if ch['new_raised'] is not None else "(unfiled)"
        print(f"  {ch['slug']:10} {old:>14} -> {new:>14}  (as of {ch['new_as_of']})")
    for slug, msg in errors:
        print(f"  ERR {slug}: {msg}", file=sys.stderr)

    return 0 if not errors else 1


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    sys.exit(main(dry_run=dry))
