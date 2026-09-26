#!/usr/bin/env python3
"""Post a CSV of deliveries to TCG Express through the external orders API.

Usage:
  python tools/bulk_post.py jobs.csv --key YOUR_API_KEY [--dry-run] [--base https://app.techchainglobal.com]

CSV columns (header row required; see TCG-bulk-jobs-template.csv):
  external_order_id, pickup_address, pickup_contact, pickup_phone,
  delivery_address, delivery_contact, delivery_phone, item_description,
  weight_kg, vehicle_required, pickup_by, deliver_by, budget_min, budget_max, instructions
Rows that fail are printed and skipped; the script never retries a row that got HTTP 409 (duplicate).
"""
import argparse, csv, json, sys, time, urllib.request, urllib.error

def post(base, key, payload):
    req = urllib.request.Request(
        f"{base.rstrip('/')}/api/external/orders",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {"error": str(e)}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--key", required=True)
    ap.add_argument("--base", default="https://app.techchainglobal.com")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    ok = dup = bad = 0
    with open(a.csv, newline="", encoding="utf-8-sig") as f:
        for i, row in enumerate(csv.DictReader(f), start=2):
            row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
            if not row.get("pickup_address") or not row.get("delivery_address"):
                print(f"row {i}: skipped (no pickup/delivery address)"); bad += 1; continue
            p = {k: v for k, v in row.items() if v}
            if "weight_kg" in p: p["weight_kg"] = float(p["weight_kg"])
            for k in ("budget_min", "budget_max"):
                if k in p: p[k] = float(p[k])
            if "instructions" in p:
                p["delivery_instructions"] = p.pop("instructions")
            if a.dry_run:
                print(f"row {i}: would post {p.get('external_order_id','')} {p['pickup_address'][:30]} -> {p['delivery_address'][:30]}"); continue
            status, body = post(a.base, a.key, p)
            if status in (200, 201):
                print(f"row {i}: OK {body.get('job_number','')} {body.get('tracking_url','')}"); ok += 1
            elif status == 409:
                print(f"row {i}: duplicate — already posted as {(body.get('existing') or {}).get('job_number','?')}"); dup += 1
            else:
                print(f"row {i}: FAILED {status} {body.get('error', body)}"); bad += 1
            time.sleep(0.4)
    print(f"\nposted {ok}, duplicates {dup}, failed {bad}")
    sys.exit(0 if bad == 0 else 1)

if __name__ == "__main__":
    main()
