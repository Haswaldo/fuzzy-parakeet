#!/usr/bin/env python3
"""Generate one static demo site per lead, plus an outreach.csv with a ready-to-send message.

Usage:
  python3 generate.py --leads leads.csv --base-url https://demos.example.com --sender "Your Name"

leads.csv columns: name, trade, area, phone, address (address optional; place_id optional)
Output: out/<slug>/index.html, out/index.html, out/outreach.csv
"""
import argparse
import csv
import datetime
import html
import json
import re
import sys
from pathlib import Path
from string import Template

HERE = Path(__file__).resolve().parent


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "business"


def phone_tel(raw):
    """UK number -> +44 form for tel: links. Returns '' if it does not look like a phone number."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("0044"):
        digits = digits[2:]
    if digits.startswith("44"):
        return "+" + digits
    if digits.startswith("0") and len(digits) >= 10:
        return "+44" + digits[1:]
    return ""


def render_site(lead, trades, template):
    trade = trades.get(lead["trade"].strip().lower(), trades["generic"])
    tel = phone_tel(lead["phone"])
    if not tel:
        raise ValueError("unusable phone number")
    esc = html.escape
    services_html = "\n".join(f'        <div class="card">{esc(s)}</div>' for s in trade["services"])
    address = (lead.get("address") or "").strip()
    address_html = f"      <p>{esc(address)}</p>" if address else ""
    return Template(template).safe_substitute(
        name=esc(lead["name"]),
        trade_label=esc(trade["label"]),
        trade_label_lower=esc(trade["label"].lower()),
        area=esc(lead["area"]),
        phone_display=esc(lead["phone"]),
        phone_tel=tel,
        accent=trade["accent"],
        tagline=esc(trade["tagline"]),
        services_html=services_html,
        address_html=address_html,
        year=datetime.date.today().year,
    )


def build_message(lead, url, sender, price, monthly):
    return (
        f"Hi, is that {lead['name']}? I noticed you don't have a website, so I built a free preview of one for you: {url}\n"
        f"If you like it, I can put it live on your own domain for £{price} one-off plus £{monthly}/month for hosting and edits. "
        f"No obligation. If it's not for you, just ignore this and I won't message again. - {sender}"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--leads", default=str(HERE / "leads.csv"))
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--base-url", default="https://demos.example.com", help="where out/ will be hosted, no trailing slash")
    ap.add_argument("--sender", default="[Your name]")
    ap.add_argument("--price", default="295")
    ap.add_argument("--monthly", default="25")
    args = ap.parse_args()

    trades = json.loads((HERE / "trades.json").read_text())
    template = (HERE / "template.html").read_text()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    seen, rows, skipped = set(), [], 0
    with open(args.leads, newline="", encoding="utf-8") as f:
        for lead in csv.DictReader(f):
            slug = slugify(lead["name"] + "-" + lead["area"])
            if slug in seen:
                slug = f"{slug}-{len(seen)}"
            seen.add(slug)
            try:
                page = render_site(lead, trades, template)
            except ValueError as e:
                print(f"skip {lead['name']!r}: {e}", file=sys.stderr)
                skipped += 1
                continue
            (out / slug).mkdir(exist_ok=True)
            (out / slug / "index.html").write_text(page, encoding="utf-8")
            url = f"{args.base_url.rstrip('/')}/{slug}/"
            rows.append({
                "name": lead["name"], "trade": lead["trade"], "area": lead["area"], "phone": lead["phone"],
                "demo_url": url, "status": "new",
                "message": build_message(lead, url, args.sender, args.price, args.monthly),
            })

    with open(out / "outreach.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["name", "trade", "area", "phone", "demo_url", "status", "message"])
        w.writeheader()
        w.writerows(rows)

    # Keep the index private: the demo host should not publish or index a list of other people's businesses.
    (out / "robots.txt").write_text("User-agent: *\nDisallow: /\n")
    print(f"built {len(rows)} sites in {out} ({skipped} skipped)")


if __name__ == "__main__":
    main()
