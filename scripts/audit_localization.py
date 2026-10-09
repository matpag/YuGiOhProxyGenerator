"""Fetch a small EN/IT sample and recursively compare every JSON leaf. No images."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

IDS = [46986414, 89631139, 55144522, 44095762, 84013237, 44508094, 1861629, 16178681, 70095154]
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/research/evidence"
BASE = "https://db.ygoprodeck.com/api/v7/cardinfo.php"

def leaves(value, path=""):
    if isinstance(value, dict) and value:
        return {p: v for k, child in value.items() for p, v in leaves(child, f"{path}.{k}" if path else k).items()}
    if isinstance(value, list) and value:
        return {p: v for i, child in enumerate(value) for p, v in leaves(child, f"{path}[{i}]").items()}
    return {path: value}

def compare():
    responses = {lang: json.loads((OUT / f"ygoprodeck-{lang}.json").read_text(encoding="utf-8")) for lang in ("en", "it")}
    cards = {lang: {c["id"]: c for c in obj.get("data", [])} for lang, obj in responses.items()}
    comparisons = []
    for card_id in IDS:
        en, it = cards["en"].get(card_id), cards["it"].get(card_id)
        if en is None or it is None:
            comparisons.append({"id": card_id, "error": "missing EN or IT card"})
            continue
        a, b = leaves(en), leaves(it)
        fields = []
        for path in sorted(a.keys() | b.keys()):
            status = "missing_en" if path not in a else "missing_it" if path not in b else "equal" if a[path] == b[path] else "different"
            fields.append({"path": path, "status": status, "en": a.get(path), "it": b.get(path)})
        comparisons.append({"id": card_id, "name_en": en["name"], "name_it": it["name"], "type_en": en["type"], "fields": fields})
    report = {"method": "All leaf paths; array indexes retained; missing differs from null; strings compared exactly", "requested_ids": IDS, "cards": comparisons,
              "response_fields": {lang: list(obj.keys()) for lang, obj in responses.items()}}
    (OUT / "field-comparison.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for card in comparisons:
        if "error" in card:
            print(card)
        else:
            changes = [f["path"] + ":" + f["status"] for f in card["fields"] if f["status"] != "equal"]
            print(card["id"], card["name_en"], "->", card["name_it"], card["type_en"], len(card["fields"]), changes)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="Recompare saved snapshots without network calls")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if not args.offline:
        requests = []
        for lang in ("en", "it"):
            url = BASE + "?id=" + ",".join(map(str, IDS)) + "&misc=yes" + ("&language=it" if lang == "it" else "")
            request = Request(url, headers={"User-Agent": "YuGiOh-Proxy-Maker-localization-audit/1.0"})
            with urlopen(request, timeout=40) as response:
                body = response.read()
                metadata = {"language": lang, "url": url, "status": response.status, "retrieved_at_utc": datetime.now(timezone.utc).isoformat(), "sha256": hashlib.sha256(body).hexdigest(), "headers": dict(response.headers)}
            json.loads(body)
            (OUT / f"ygoprodeck-{lang}.json").write_bytes(body)
            requests.append(metadata)
        (OUT / "requests.json").write_text(json.dumps(requests, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    compare()

if __name__ == "__main__":
    main()

