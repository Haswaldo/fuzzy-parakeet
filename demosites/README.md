# Demo-site outreach pipeline

Find UK local businesses with a phone number and no website, generate a draft preview site for each, and send the owner the link.

```bash
export GOOGLE_PLACES_API_KEY=...                       # Places API (New) enabled
python3 scrape_places.py --trade plumber --city Leeds --max 60   # -> leads.csv
python3 generate.py --base-url https://YOUR-DEMO-HOST --sender "Your Name"   # -> out/
```

`out/<slug>/index.html` is one static site per lead (deploy `out/` to Cloudflare Pages or Netlify). `out/outreach.csv` has the message for each lead, ready to paste. Try it without a key: `python3 generate.py --leads leads.sample.csv`.

Trades are defined in `trades.json` (plumber, electrician, roofer, builder, landscaper, cleaner, painter, locksmith, generic). The `--trade` value must match a key or it falls back to `generic`.

## 7-day plan

| Day | Task |
|---|---|
| 1 | Pick one trade and 2-3 cities. Get the Places API key. Run the scraper. Skim and tidy the template copy. |
| 2 | Generate 100+ sites, deploy, open 5 on your phone. Fix anything broken. |
| 3-6 | Send 30-40 messages a day (see `outreach.md`). Follow up once on day 3 and day 5. |
| 7 | Take payment by Stripe link before going live. Point their domain. Ask for referrals. |

## Rules of the road

- **Draft banner and noindex stay on.** Demos use a real business's name, so they are marked as unreviewed drafts and hidden from search. Remove both only after the owner agrees and has checked the content.
- **No invented claims.** The template has no reviews, years in business, accreditations or prices. Add only what the owner confirms (e.g. Gas Safe, NICEIC).
- **Google Places data.** The API terms restrict storing and reusing its data. This keeps only name, phone and address for prospecting, and doesn't copy ratings or reviews. Read the current terms before scaling.
- **PECR.** Email to limited companies is allowed with your identity and an opt-out. Sole traders count as individuals: use phone, a contact form, or a DM on their business account, and stop when asked.
- **Refund or take down** immediately if anyone objects to a demo.
