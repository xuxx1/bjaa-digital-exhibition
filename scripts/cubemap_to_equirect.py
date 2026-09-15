from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


FACE_FILES = {
    "front": "front.jpg",
    "right": "right.jpg",
    "back": "back.jpg",
    "left": "left.jpg",
    "up": "up.jpg",
    "down": "down.jpg",
}


def bilinear_sample(image: np.ndarray, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    x = np.clip(u * (width - 1), 0, width - 1)
    y = np.clip(v * (height - 1), 0, height - 1)
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    x1 = np.minimum(x0 + 1, width - 1)
    y1 = np.minimum(y0 + 1, height - 1)
    dx = (x - x0)[..., None]
    dy = (y - y0)[..., None]
    top = image[y0, x0] * (1 - dx) + image[y0, x1] * dx
    bottom = image[y1, x0] * (1 - dx) + image[y1, x1] * dx
    return top * (1 - dy) + bottom * dy


def render_equirect(faces: dict[str, np.ndarray], width: int) -> Image.Image:
    height = width // 2
    longitude = (np.arange(width, dtype=np.float32) + 0.5) / width * (2 * np.pi) - np.pi
    latitude = (np.arange(height, dtype=np.float32) + 0.5) / height * np.pi - np.pi / 2
    lon, lat = np.meshgrid(longitude, latitude)
    cos_lat = np.cos(lat)
    x = np.sin(lon) * cos_lat
    y = -np.sin(lat)
    z = np.cos(lon) * cos_lat
    absolute = np.stack((np.abs(x), np.abs(y), np.abs(z)), axis=-1)
    major = np.argmax(absolute, axis=-1)
    result = np.zeros((height, width, 3), dtype=np.float32)

    masks_and_coordinates = [
        ("front", (major == 2) & (z >= 0), lambda d: ((x[d] / z[d] + 1) / 2, (-y[d] / z[d] + 1) / 2)),
        ("back", (major == 2) & (z < 0), lambda d: ((-x[d] / -z[d] + 1) / 2, (-y[d] / -z[d] + 1) / 2)),
        ("right", (major == 0) & (x >= 0), lambda d: ((-z[d] / x[d] + 1) / 2, (-y[d] / x[d] + 1) / 2)),
        ("left", (major == 0) & (x < 0), lambda d: ((z[d] / -x[d] + 1) / 2, (-y[d] / -x[d] + 1) / 2)),
        ("up", (major == 1) & (y >= 0), lambda d: ((x[d] / y[d] + 1) / 2, (z[d] / y[d] + 1) / 2)),
        ("down", (major == 1) & (y < 0), lambda d: ((x[d] / -y[d] + 1) / 2, (-z[d] / -y[d] + 1) / 2)),
    ]

    for face_name, mask, coordinate_factory in masks_and_coordinates:
        u, v = coordinate_factory(mask)
        result[mask] = bilinear_sample(faces[face_name], u, v)

    return Image.fromarray(np.clip(result, 0, 255).astype(np.uint8))


def convert(input_dir: Path, output_path: Path, width: int, quality: int) -> None:
    faces = {
        name: np.asarray(Image.open(input_dir / filename).convert("RGB"), dtype=np.float32)
        for name, filename in FACE_FILES.items()
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    render_equirect(faces, width).save(
        output_path,
        quality=quality,
        optimize=True,
        progressive=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("output_path", type=Path)
    parser.add_argument("--width", type=int, default=1536)
    parser.add_argument("--quality", type=int, default=80)
    args = parser.parse_args()
    convert(args.input_dir, args.output_path, args.width, args.quality)


if __name__ == "__main__":
    main()
