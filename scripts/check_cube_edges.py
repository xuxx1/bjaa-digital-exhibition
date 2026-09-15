from pathlib import Path

import numpy as np
from PIL import Image


root = Path("subpackage/virtual/assets/scene_a16")
images = {
    name: np.asarray(Image.open(root / f"{name}.jpg").convert("RGB"), dtype=np.float32)
    for name in ("front", "right", "back", "left", "up", "down")
}


def edges(image: np.ndarray) -> dict[str, np.ndarray]:
    return {
        "top": image[0],
        "right": image[:, -1],
        "bottom": image[-1],
        "left": image[:, 0],
    }


def score(first: np.ndarray, second: np.ndarray) -> float:
    return float(np.mean(np.abs(first - second)))


for pole in ("up", "down"):
    print(pole.upper())
    pole_edges = edges(images[pole])
    side_edge_name = "top" if pole == "up" else "bottom"
    for side in ("front", "right", "back", "left"):
        source = edges(images[side])[side_edge_name]
        matches: list[tuple[float, str]] = []
        for edge_name, candidate in pole_edges.items():
            matches.append((score(source, candidate), edge_name))
            matches.append((score(source, candidate[::-1]), edge_name + " reversed"))
        matches.sort()
        best = ", ".join(f"{name}={value:.2f}" for value, name in matches[:4])
        print(f"  {side:5s} -> {best}")

print("SIDE WALLS")
for first, second in (("front", "right"), ("right", "back"), ("back", "left"), ("left", "front")):
    first_edges = edges(images[first])
    second_edges = edges(images[second])
    options = [
        (score(first_edges["right"], second_edges["left"]), "right-left"),
        (score(first_edges["right"], second_edges["left"][::-1]), "right-left reversed"),
        (score(first_edges["left"], second_edges["right"]), "left-right"),
        (score(first_edges["left"], second_edges["right"][::-1]), "left-right reversed"),
    ]
    options.sort()
    print(f"  {first:5s} -> {second:5s}: {options[0][1]:20s} score={options[0][0]:.2f}")
