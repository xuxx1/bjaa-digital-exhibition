from pathlib import Path

import numpy as np
from PIL import Image


root = Path(__file__).resolve().parents[1] / "dataset" / "virtual_gallery" / "complete" / "panoramas"
results = []
for path in sorted(root.glob("*.jpg")):
    image = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    wrap_error = float(np.mean(np.abs(image[:, 0] - image[:, -1])))
    adjacent = np.mean(np.abs(image[:, 1:] - image[:, :-1]), axis=(0, 2))
    median_gradient = float(np.median(adjacent))
    results.append((wrap_error, median_gradient, path.name))

worst = sorted(results, reverse=True)[:10]
print(f"panoramas={len(results)}")
print(f"max_wrap_error={max(item[0] for item in results):.2f}")
print(f"mean_wrap_error={np.mean([item[0] for item in results]):.2f}")
for wrap_error, median_gradient, name in worst:
    print(f"{name}: wrap={wrap_error:.2f}, median_adjacent={median_gradient:.2f}")
