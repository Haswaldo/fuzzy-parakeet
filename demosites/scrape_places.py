#!/usr/bin/env python3
"""Find UK local businesses with a phone number and NO website, via the Google Places API (New).

Needs a key with Places API (New) enabled:  export GOOGLE_PLACES_API_KEY=...
Usage:  python3 scrape_places.py --trade plumber --city Leeds --max 60
Appends to leads.csv (deduplicated by place_id).
"""
import argparse
import csv
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

URL = "https://places.googleapis.com/v1/places:searchText"
FIELDS = ",".join([
    "places.id", "places.displayName", "places.formattedAddress", "places.nationalPhoneNumber",
    "places.websiteUri", "places.businessStatus", "nextPageToken",
])
COLUMNS = ["place_id", "name", "trade", "area", "phone", "address"]


def parse_places(resp, trade, area):
    """Keep operational businesses that have a phone number and no website."""
    leads = []
    for p in resp.get("places", []):
        if p.get("websiteUri") or p.get("businessStatus", "OPERATIONAL") != "OPERATIONAL":
            continue
        phone = p.get("nationalPhoneNumber")
        if not phone:
            continue
        leads.append({
            "place_id": p["id"],
            "name": p.get("displayName", {}).get("text", "").strip(),
            "trade": trade,
            "area": area,
            "phone": phone,
            "address": p.get("formattedAddress", ""),
        })
    return leads


def search(key, query, page_token=None):
    body = {"textQuery": query, "regionCode": "GB", "languageCode": "en-GB", "pageSize": 20}
    if page_token:
        body["pageToken"] = page_token
    req = urllib.request.Request(
        URL, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--trade", required=True, help="e.g. plumber, electrician, roofer (should match a key in trades.json)")
    ap.add_argument("--city", required=True)
    ap.add_argument("--max", type=int, default=60, help="max raw results to scan")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent / "leads.csv"))
    args = ap.parse_args()

    key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not key:
        sys.exit("Set GOOGLE_PLACES_API_KEY first.")

    existing = set()
    out = Path(args.out)
    if out.exists():
        with open(out, newline="", encoding="utf-8") as f:
            existing = {r["place_id"] for r in csv.DictReader(f)}

    found, scanned, token = [], 0, None
    while scanned < args.max:
        resp = search(key, f"{args.trade} in {args.city}, UK", token)
        scanned += len(resp.get("places", []))
        found += [l for l in parse_places(resp, args.trade, args.city) if l["place_id"] not in existing]
        token = resp.get("nextPageToken")
        if not token:
            break
        time.sleep(1)

    new_file = not out.exists()
    with open(out, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        if new_file:
            w.writeheader()
        w.writerows(found)
    print(f"scanned {scanned}, added {len(found)} leads with a phone and no website -> {out}")


if __name__ == "__main__":
    main()
