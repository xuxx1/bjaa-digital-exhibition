from __future__ import annotations

import json
import math
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dataset" / "virtual_gallery" / "complete"
TEMPLATE = ROOT / "scripts" / "gallery-template"
SUBPACKAGE_ROOT = ROOT / "subpackage"
OFFICIAL_COORDINATES = ROOT / "dataset" / "virtual_gallery" / "official_cache" / "xml" / "coordinate.xml"
OFFICIAL_MODELS = ROOT / "dataset" / "virtual_gallery" / "official_cache" / "panos" / "uvobj"
ASSET_LIMIT = int(1.95 * 1024 * 1024)
SCROLL_PANORAMAS = SOURCE / "scroll-panoramas"
SCROLL_WIDTH = 1920
SCROLL_QUALITY = 66


def prepare_scroll_panoramas(scenes: list[dict[str, object]]) -> None:
    SCROLL_PANORAMAS.mkdir(parents=True, exist_ok=True)
    for scene in scenes:
        name = str(scene["panorama"])
        source = SOURCE / "panoramas" / name
        target = SCROLL_PANORAMAS / name
        with Image.open(source) as image:
            rendered = image.convert("RGB")
            rendered.thumbnail((SCROLL_WIDTH, SCROLL_WIDTH // 2), Image.Resampling.LANCZOS)
            rendered.save(target, "JPEG", quality=SCROLL_QUALITY, optimize=True, progressive=True)


def scene_weight(scene: dict[str, object]) -> int:
    panorama = SCROLL_PANORAMAS / str(scene["panorama"])
    images = {image for hotspot in scene["hotspots"] for image in hotspot.get("images", [])}
    return panorama.stat().st_size + sum((SOURCE / "artworks" / image).stat().st_size for image in images)


def group_scenes(scenes: list[dict[str, object]]) -> list[list[dict[str, object]]]:
    first_group_size = 1
    groups: list[list[dict[str, object]]] = [scenes[:first_group_size]]
    current: list[dict[str, object]] = []
    current_size = 0
    for scene in scenes[first_group_size:]:
        weight = scene_weight(scene)
        if current and current_size + weight > ASSET_LIMIT:
            groups.append(current)
            current = []
            current_size = 0
        current.append(scene)
        current_size += weight
    if current:
        groups.append(current)
    return groups


def scene_name(scene: dict[str, object]) -> str:
    scene_id = str(scene["id"])
    if scene_id == "scene_wj":
        return "序厅"
    if "_a" in scene_id:
        return f"A 展区 · 展厅 {str(scene['title']).zfill(2)}"
    return f"B 展区 · 展厅 {str(scene['title']).zfill(2)}"


def normalize_heading(value: float) -> float:
    while value > 180:
        value -= 360
    while value < -180:
        value += 360
    return round(value, 3)


def official_scene_positions() -> dict[str, tuple[float, float]]:
    root = ET.parse(OFFICIAL_COORDINATES).getroot()
    positions: dict[str, tuple[float, float]] = {}
    for style in root.findall("style"):
        scene_id = style.attrib.get("linkedscene", "")
        if not scene_id.startswith("scene_") or "ox" not in style.attrib or "oz" not in style.attrib:
            continue
        # krpano 的 depthmap center 使用 (oz, y, -ox)，与全景水平角的坐标轴不同。
        positions[scene_id] = (float(style.attrib["oz"]), -float(style.attrib["ox"]))
    return positions


def model_wall_segments(model_name: str) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    """提取人眼高度处的墙线，用于排除隔墙后的错误行走锚点。"""
    path = OFFICIAL_MODELS / model_name
    vertices: list[tuple[float, float, float]] = []
    faces: list[list[int]] = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("v "):
            _, x, y, z = line.split()[:4]
            vertices.append((float(x), float(y), float(z)))
        elif line.startswith("f "):
            faces.append([int(token.split("/")[0]) - 1 for token in line.split()[1:]])
    segments = []
    eye_height = 1.2
    for face in faces:
        points = [vertices[index] for index in face]
        ys = [point[1] for point in points]
        if min(ys) > eye_height or max(ys) < eye_height:
            continue
        footprint = []
        for x, _, z in points:
            if not any(math.hypot(x - px, z - pz) < 0.01 for px, pz in footprint):
                footprint.append((x, z))
        if len(footprint) != 2 or math.dist(footprint[0], footprint[1]) < 0.15:
            continue
        segments.append((footprint[0], footprint[1]))
    return segments


def segment_crosses_wall(
    start: tuple[float, float],
    end: tuple[float, float],
    walls: list[tuple[tuple[float, float], tuple[float, float]]],
) -> bool:
    def cross(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float:
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    for wall_start, wall_end in walls:
        if min(math.dist(start, wall_start), math.dist(start, wall_end), math.dist(end, wall_start), math.dist(end, wall_end)) < 0.12:
            continue
        c1 = cross(start, end, wall_start)
        c2 = cross(start, end, wall_end)
        c3 = cross(wall_start, wall_end, start)
        c4 = cross(wall_start, wall_end, end)
        if c1 * c2 < -1e-6 and c3 * c4 < -1e-6:
            return True
    return False


def scene_zone(scene_id: str) -> str:
    if scene_id.startswith("scene_a"):
        return "a"
    if scene_id.startswith("scene_b"):
        return "b"
    return "entrance"


def navigation_anchors(
    scene: dict[str, object],
    all_scenes: list[dict[str, object]],
    positions: dict[str, tuple[float, float]],
    walls_by_zone: dict[str, list[tuple[tuple[float, float], tuple[float, float]]]],
) -> list[dict[str, object]]:
    scene_id = str(scene["id"])
    if scene_id == "scene_wj":
        return [{
            "id": "scene_wj-official-entry",
            "targetId": "scene_a01",
            "label": "进入 A 展区",
            "ath": -57.222,
            "atv": 18.75,
            "distance": 2.5,
        }]
    if scene_id not in positions:
        return []
    current_x, current_z = positions[scene_id]
    zone = scene_zone(scene_id)
    candidates = []
    for target in all_scenes:
        target_id = str(target["id"])
        if target_id == scene_id or scene_zone(target_id) != zone or target_id not in positions:
            continue
        target_x, target_z = positions[target_id]
        dx = target_x - current_x
        dz = target_z - current_z
        distance = math.hypot(dx, dz)
        blocked = segment_crosses_wall((current_x, current_z), (target_x, target_z), walls_by_zone.get(zone, []))
        candidates.append((distance, target, dx, dz, blocked))
    candidates.sort(key=lambda item: item[0])
    selected = [item for item in candidates if item[0] <= 5.2 and not item[4]][:5]
    if len(selected) < 2:
        # 门楣或薄墙可能在二维投影里产生误判；补回最近的短距离机位，
        # 避免因过滤过严而出现跨越整个展厅的远距离锚点。
        for item in candidates:
            if item[0] > 4.6 or item in selected:
                continue
            selected.append(item)
            if len(selected) >= 2:
                break
    anchors = []
    for distance, target, dx, dz, _ in selected:
        target_id = str(target["id"])
        anchors.append({
            "id": f"{scene_id}-walk-{target_id}",
            "targetId": target_id,
            "label": f"前往展厅 {target['number']}",
            "ath": normalize_heading(math.degrees(math.atan2(dx, dz))),
            "atv": round(math.degrees(math.atan2(1.46, max(distance, 0.2))), 3),
            "distance": round(distance, 2),
        })
    if scene_id == "scene_a03":
        anchors.append({
            "id": "scene_a03-official-b-entry",
            "targetId": "scene_b01",
            "label": "进入 B 展区",
            "ath": 30,
            "atv": 40,
            "distance": 2.5,
        })
    return anchors


def data_source(
    group: list[dict[str, object]],
    group_index: int,
    group_count: int,
    all_groups: list[list[dict[str, object]]],
) -> str:
    root_name = f"gallery{group_index + 1:02d}"
    flat_scenes = [scene for package_scenes in all_groups for scene in package_scenes]
    scenes = []
    for scene in group:
        artworks = []
        for hotspot in scene["hotspots"]:
            images = [f"/subpackage/{root_name}/assets/artworks/{image}" for image in hotspot.get("images", [])]
            artworks.append({
                "id": hotspot["id"],
                "title": hotspot["title"],
                "note": "展厅原始作品资料" if len(images) <= 1 else "多页作品资料",
                "image": images[0] if images else "",
                "images": images,
                "ath": hotspot["ath"],
                "atv": hotspot["atv"],
            })
        scenes.append({
            "id": scene["id"],
            "name": scene_name(scene),
            "number": scene["number"],
            "initialHlookat": scene["initialHlookat"],
            "initialVlookat": scene["initialVlookat"],
            "panorama": f"/subpackage/{root_name}/assets/panoramas/{scene['panorama']}",
            "artworks": artworks,
            "navigationAnchors": [],
        })
    previous_url = None if group_index == 0 else f"/subpackage/gallery{group_index:02d}/pages/gallery/virtual-gallery"
    next_url = None if group_index == group_count - 1 else f"/subpackage/gallery{group_index + 2:02d}/pages/gallery/virtual-gallery"
    next_package_name = None if group_index == group_count - 1 else f"gallery{group_index + 2:02d}"
    all_scenes = []
    for package_index, package_scenes in enumerate(all_groups):
        package_name = f"gallery{package_index + 1:02d}"
        package_url = f"/subpackage/{package_name}/pages/gallery/virtual-gallery"
        for local_index, scene in enumerate(package_scenes):
            all_scenes.append({
                "id": scene["id"],
                "number": scene["number"],
                "name": scene_name(scene),
                "packageName": package_name,
                "localIndex": local_index,
                "url": f"{package_url}?scene={scene['id']}",
            })
    payload = {
        "groupNumber": f"{group_index + 1:02d}",
        "groupCount": group_count,
        "totalScenes": len(flat_scenes),
        "packageName": root_name,
        "rangeLabel": f"场景 {scenes[0]['number']}–{scenes[-1]['number']}",
        "previousUrl": previous_url,
        "nextUrl": next_url,
        "nextPackageName": next_package_name,
        "exhibition": {
            "title": "真言可贵——周思聪的变法之路",
            "time": "2026年06月19日 至 2026年07月19日",
            "intro": f"完整数字展厅包含 {len(flat_scenes)} 个全景场景、67 个作品热点，可通过目录或场景按钮切换观看。",
        },
        "scenes": scenes,
        "allScenes": all_scenes,
    }
    json_payload = json.dumps(payload, ensure_ascii=False, indent=2)
    return f"""export interface VirtualArtwork {{
  id: string
  title: string
  note: string
  image: string
  images: string[]
  ath: number
  atv: number
}}

export interface VirtualScene {{
  id: string
  name: string
  number: string
  initialHlookat: number
  initialVlookat: number
  panorama: string
  artworks: VirtualArtwork[]
  navigationAnchors: {{ id: string; targetId: string; label: string; ath: number; atv: number; distance: number }}[]
}}

export const GALLERY_GROUP = {json_payload}
"""


def build_group(
    group: list[dict[str, object]],
    group_index: int,
    group_count: int,
    all_groups: list[list[dict[str, object]]],
) -> dict[str, object]:
    root_name = f"gallery{group_index + 1:02d}"
    target = SUBPACKAGE_ROOT / root_name
    if target.exists():
        shutil.rmtree(target)
    page_dir = target / "pages" / "gallery"
    data_dir = target / "data"
    panorama_dir = target / "assets" / "panoramas"
    artwork_dir = target / "assets" / "artworks"
    for directory in (page_dir, data_dir, panorama_dir, artwork_dir):
        directory.mkdir(parents=True, exist_ok=True)
    for template_file in TEMPLATE.glob("virtual-gallery.*"):
        shutil.copy2(template_file, page_dir / template_file.name)
    (data_dir / "gallery.ts").write_text(
        data_source(group, group_index, group_count, all_groups),
        encoding="utf-8",
    )
    artwork_names = set()
    for scene in group:
        shutil.copy2(SCROLL_PANORAMAS / str(scene["panorama"]), panorama_dir / str(scene["panorama"]))
        for hotspot in scene["hotspots"]:
            artwork_names.update(hotspot.get("images", []))
    for artwork_name in artwork_names:
        shutil.copy2(SOURCE / "artworks" / artwork_name, artwork_dir / artwork_name)
    size = sum(path.stat().st_size for path in target.rglob("*") if path.is_file())
    return {
        "root": f"subpackage/{root_name}",
        "name": root_name,
        "pages": ["pages/gallery/virtual-gallery"],
        "sceneStart": group[0]["number"],
        "sceneEnd": group[-1]["number"],
        "sceneCount": len(group),
        "size": size,
    }


def main() -> None:
    scenes = json.loads((SOURCE / "gallery.json").read_text(encoding="utf-8"))
    prepare_scroll_panoramas(scenes)
    groups = group_scenes(scenes)
    for existing in SUBPACKAGE_ROOT.glob("gallery[0-9][0-9]"):
        if existing.is_dir():
            shutil.rmtree(existing)
    manifest = [build_group(group, index, len(groups), groups) for index, group in enumerate(groups)]
    manifest_path = SOURCE / "package-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    app_path = ROOT / "app.json"
    app_config = json.loads(app_path.read_text(encoding="utf-8"))
    app_config["subPackages"] = [
        {"root": item["root"], "name": item["name"], "pages": item["pages"]}
        for item in manifest
    ]
    app_config["preloadRule"] = {
        "pages/exhibitions/exhibitions": {"network": "all", "packages": ["gallery01"]}
    }
    app_path.write_text(json.dumps(app_config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"groups: {len(manifest)}")
    for item in manifest:
        print(
            f"{item['name']}: scenes {item['sceneStart']}-{item['sceneEnd']} "
            f"({item['sceneCount']}), {item['size'] / 1024 / 1024:.2f} MB"
        )


if __name__ == "__main__":
    main()
