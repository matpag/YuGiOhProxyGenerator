"""Compare UI screenshots captured by check-ui-visuals.cjs (requires Pillow)."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops

root = Path(__file__).resolve().parents[1] / "docs" / "validation" / "state-refactor"
before_name, after_name = sys.argv[1:3] if len(sys.argv) == 3 else ("before", "after")
results = []
for before in sorted((root / before_name).glob("*.png")):
    after = root / after_name / before.name
    first, second = Image.open(before).convert("RGB"), Image.open(after).convert("RGB")
    same_size = first.size == second.size
    difference = ImageChops.difference(first, second) if same_size else None
    box = difference.getbbox() if difference else None
    changed = maximum = None
    if difference:
        red, green, blue = difference.split()
        magnitude = ImageChops.lighter(ImageChops.lighter(red, green), blue)
        histogram = magnitude.histogram()
        changed = first.width * first.height - histogram[0]
        maximum = magnitude.getextrema()[1]
    results.append({"file": before.name, "beforeSize": first.size, "afterSize": second.size,
                    "changedPixels": changed, "maximumChannelDifference": maximum, "differenceBox": box})
    if box:
        directory = root / ("differences-" + before_name + "-" + after_name)
        directory.mkdir(exist_ok=True)
        difference.save(directory / before.name)
report = root / ("pixels-" + before_name + "-" + after_name + ".json")
report.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
# Permit only isolated antialiasing differences, not shifted elements or changed images.
max_channel_difference, max_changed_fraction = 8, 0.0001
failures = [item for item in results if item["changedPixels"] is None
            or item["maximumChannelDifference"] > max_channel_difference
            or item["changedPixels"] / (item["beforeSize"][0] * item["beforeSize"][1]) > max_changed_fraction]
assert results, "No baseline screenshots found"
assert not failures, json.dumps(failures, indent=2)
exact = sum(item["changedPixels"] == 0 for item in results)
print(f"{len(results)} screenshots match: {exact} are pixel-identical; "
      f"{len(results)-exact} differ only within the strict antialiasing tolerance.")
