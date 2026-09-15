from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
GALLERY = ROOT / "dataset" / "virtual_gallery" / "complete" / "gallery.json"
PANORAMAS = GALLERY.parent / "panoramas"
ARTWORKS = GALLERY.parent / "artworks"
OUTPUT = GALLERY.parent / "hotspot-calibration.json"
TARGET_WIDTH = 1536


def features(image: np.ndarray, limit: int) -> tuple[list[cv2.KeyPoint], np.ndarray | None]:
    detector = cv2.SIFT_create(nfeatures=limit, contrastThreshold=0.025)
    return detector.detectAndCompute(image, None)


def read_gray(path: Path) -> np.ndarray | None:
    try:
        return cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
    except (OSError, ValueError):
        return None


def calibrate(scene: dict[str, object]) -> list[dict[str, object]]:
    panorama_path = PANORAMAS / str(scene["panorama"])
    panorama = read_gray(panorama_path)
    if panorama is None:
        return []
    scale = TARGET_WIDTH / panorama.shape[1]
    panorama = cv2.resize(panorama, (TARGET_WIDTH, round(panorama.shape[0] * scale)), interpolation=cv2.INTER_AREA)
    pano_points, pano_descriptors = features(panorama, 7000)
    if pano_descriptors is None:
        return []
    matcher = cv2.BFMatcher(cv2.NORM_L2)
    results = []
    for hotspot in scene.get("hotspots", []):
        images = hotspot.get("images", [])
        if not images:
            continue
        artwork = read_gray(ARTWORKS / images[0])
        if artwork is None:
            continue
        if artwork.shape[1] > 760:
            artwork = cv2.resize(artwork, (760, round(artwork.shape[0] * 760 / artwork.shape[1])), interpolation=cv2.INTER_AREA)
        art_points, art_descriptors = features(artwork, 2500)
        if art_descriptors is None:
            continue
        pairs = matcher.knnMatch(art_descriptors, pano_descriptors, k=2)
        good = [first for first, second in pairs if first.distance < 0.72 * second.distance]
        if len(good) < 7:
            continue
        source = np.float32([art_points[item.queryIdx].pt for item in good]).reshape(-1, 1, 2)
        target = np.float32([pano_points[item.trainIdx].pt for item in good]).reshape(-1, 1, 2)
        matrix, mask = cv2.findHomography(source, target, cv2.RANSAC, 5.0)
        if matrix is None or mask is None or int(mask.sum()) < 6:
            continue
        height, width = artwork.shape
        corners = np.float32([[[0, 0], [width, 0], [width, height], [0, height]]])
        projected = cv2.perspectiveTransform(corners, matrix)[0]
        center_x = float(projected[:, 0].mean())
        center_y = float(projected[:, 1].mean())
        polygon_area = float(abs(cv2.contourArea(projected)))
        if not (0 <= center_x < panorama.shape[1] and 0 <= center_y < panorama.shape[0]):
            continue
        if polygon_area < 180 or polygon_area > panorama.size * 0.35:
            continue
        ath = center_x / panorama.shape[1] * 360 - 180
        atv = center_y / panorama.shape[0] * 180 - 90
        results.append({
            "id": hotspot["id"],
            "title": hotspot["title"],
            "ath": round(ath, 3),
            "atv": round(atv, 3),
            "sourceAth": hotspot["ath"],
            "sourceAtv": hotspot["atv"],
            "matches": len(good),
            "inliers": int(mask.sum()),
        })
    return results


def main() -> None:
    scenes = json.loads(GALLERY.read_text(encoding="utf-8"))
    calibrated = {}
    for scene in scenes:
        if not scene.get("hotspots"):
            continue
        results = calibrate(scene)
        if results:
            calibrated[scene["id"]] = results
            print(f"{scene['id']}: {len(results)}/{len(scene['hotspots'])}", flush=True)
    OUTPUT.write_text(json.dumps(calibrated, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"calibrated: {sum(len(items) for items in calibrated.values())}", flush=True)


if __name__ == "__main__":
    main()
