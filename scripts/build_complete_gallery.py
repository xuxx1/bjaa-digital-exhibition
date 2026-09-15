from __future__ import annotations

import concurrent.futures
import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from PIL import Image

from cubemap_to_equirect import render_equirect


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "dataset" / "virtual_gallery"
CACHE = DATASET / "complete_cache"
OUTPUT = DATASET / "complete"
BASE_URL = "https://quanjing.artron.net/scene/MUhM9H7t5KtV3oMvCse93zLsZbP8uicR/20260626-zykg/"
FACE_NAMES = {"front": "f", "right": "r", "back": "b", "left": "l", "up": "u", "down": "d"}
PANORAMA_WIDTH = 3072
PANORAMA_QUALITY = 55


def download(url: str, destination: Path) -> None:
    if destination.exists() and destination.stat().st_size > 100:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": BASE_URL})
    error: Exception | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                data = response.read()
            if len(data) < 100:
                raise RuntimeError(f"empty response: {url}")
            temporary = destination.with_suffix(destination.suffix + ".part")
            temporary.write_bytes(data)
            temporary.replace(destination)
            return
        except Exception as exc:
            error = exc
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"download failed: {url}: {error}")


def scene_records() -> list[dict[str, object]]:
    root = ET.parse(DATASET / "tour.xml").getroot()
    records: list[dict[str, object]] = []
    for scene in root.findall("scene"):
        scene_id = scene.attrib.get("name", "")
        if not scene_id.startswith("scene_"):
            continue
        cube = scene.find("./image/cube")
        view = scene.find("view")
        if cube is None or view is None:
            continue
        cube_url = cube.attrib["url"]
        remote_match = re.search(r"panos/([^/]+)\.tiles/", cube_url)
        if not remote_match:
            continue
        hotspots = []
        for hotspot_index, hotspot in enumerate(scene.findall("hotspot")):
            if not hotspot.attrib.get("picurl"):
                continue
            title_match = re.search(r"showtext\((.*?),STYLE", hotspot.attrib.get("onhover", ""))
            hotspots.append({
                "id": f"{scene_id}-hotspot-{hotspot_index + 1}",
                "data": hotspot.attrib.get("data", ""),
                "title": title_match.group(1) if title_match else "展览作品",
                "ath": float(hotspot.attrib.get("ath", 0)),
                "atv": float(hotspot.attrib.get("atv", 0)),
                "picurl": hotspot.attrib["picurl"],
            })
        records.append({
            "id": scene_id,
            "remote": remote_match.group(1),
            "title": scene.attrib.get("title", str(len(records) + 1)),
            "initialHlookat": float(view.attrib.get("hlookat", 0)),
            "initialVlookat": float(view.attrib.get("vlookat", 0)),
            "hotspots": hotspots,
        })
    return records


def tile_jobs(scenes: list[dict[str, object]]) -> list[tuple[str, Path]]:
    jobs = []
    for scene in scenes:
        scene_id = str(scene["id"])
        remote = str(scene["remote"])
        for face in FACE_NAMES.values():
            for vertical in range(1, 3):
                for horizontal in range(1, 3):
                    v = f"{vertical:02d}"
                    h = f"{horizontal:02d}"
                    filename = f"l1_{face}_{v}_{h}.jpg"
                    url = urllib.parse.urljoin(BASE_URL, f"panos/{remote}.tiles/{face}/l1/{v}/{filename}")
                    destination = CACHE / "tiles" / scene_id / face / filename
                    jobs.append((url, destination))
    return jobs


def download_all(jobs: list[tuple[str, Path]]) -> None:
    with concurrent.futures.ThreadPoolExecutor(max_workers=18) as executor:
        futures = [executor.submit(download, url, path) for url, path in jobs]
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            future.result()
            if index % 100 == 0 or index == len(futures):
                print(f"downloaded {index}/{len(futures)}", flush=True)


def build_panorama(scene: dict[str, object]) -> None:
    scene_id = str(scene["id"])
    panorama_path = OUTPUT / "panoramas" / f"{scene_id}.jpg"
    if panorama_path.exists() and panorama_path.stat().st_size > 1000:
        with Image.open(panorama_path) as current:
            if current.width == PANORAMA_WIDTH:
                return
    faces: dict[str, np.ndarray] = {}
    for face_name, face_code in FACE_NAMES.items():
        canvas = Image.new("RGB", (768, 768))
        for vertical in range(1, 3):
            for horizontal in range(1, 3):
                v = f"{vertical:02d}"
                h = f"{horizontal:02d}"
                filename = f"l1_{face_code}_{v}_{h}.jpg"
                tile = Image.open(CACHE / "tiles" / scene_id / face_code / filename).convert("RGB")
                canvas.paste(tile, ((horizontal - 1) * 512, (vertical - 1) * 512))
        faces[face_name] = np.asarray(canvas, dtype=np.float32)
    panorama_path.parent.mkdir(parents=True, exist_ok=True)
    render_equirect(faces, PANORAMA_WIDTH).save(
        panorama_path,
        quality=PANORAMA_QUALITY,
        optimize=True,
        progressive=True,
    )


def local_artwork_lookup() -> dict[str, Path]:
    return {path.name.lower(): path for path in (DATASET / "artworks").glob("*.jpg")}


def absolute_artwork_urls(value: str) -> list[str]:
    urls = []
    for index, item in enumerate(value.split("|")):
        if index == 0:
            urls.append(item)
        else:
            urls.append(urllib.parse.urljoin(BASE_URL, item.removeprefix("./")))
    return urls


def prepare_artworks(scenes: list[dict[str, object]]) -> list[dict[str, object]]:
    source_records = json.loads((DATASET / "artworks.json").read_text(encoding="utf-8"))
    local_lookup = local_artwork_lookup()
    prepared = []
    remote_jobs: list[tuple[str, Path]] = []
    for record_index, record in enumerate(source_records):
        urls = absolute_artwork_urls(record["image"])
        sources = []
        for page_index, url in enumerate(urls):
            basename = Path(urllib.parse.urlparse(url).path).name.lower()
            local = local_lookup.get(basename) if len(urls) == 1 else None
            if local:
                sources.append(local)
            else:
                destination = CACHE / "artworks" / f"record_{record_index:02d}" / f"page_{page_index + 1:02d}.jpg"
                remote_jobs.append((url, destination))
                sources.append(destination)
        prepared.append({**record, "recordIndex": record_index, "sources": sources})
    download_all(remote_jobs)

    for prepared_record in prepared:
        output_images = []
        for page_index, source in enumerate(prepared_record["sources"]):
            output_name = f"artwork_{prepared_record['recordIndex']:02d}_{page_index + 1:02d}.jpg"
            output_path = OUTPUT / "artworks" / output_name
            output_path.parent.mkdir(parents=True, exist_ok=True)
            image = Image.open(source).convert("RGB")
            image.thumbnail((680, 680), Image.Resampling.LANCZOS)
            image.save(output_path, quality=72, optimize=True, progressive=True)
            output_images.append(output_name)
        prepared_record["outputImages"] = output_images

    for scene in scenes:
        scene_hotspots = scene["hotspots"]
        candidates = [item for item in prepared if item["scene"] == scene["id"]]
        used: set[int] = set()
        for hotspot in scene_hotspots:
            hotspot_basename = Path(hotspot["picurl"].split("|")[0]).name.lower()
            match = None
            for candidate in candidates:
                if candidate["recordIndex"] in used:
                    continue
                first_url_name = Path(urllib.parse.urlparse(candidate["image"].split("|")[0]).path).name.lower()
                if first_url_name == hotspot_basename:
                    match = candidate
                    break
            if match is None:
                match = next((candidate for candidate in candidates if candidate["recordIndex"] not in used), None)
            if match:
                used.add(match["recordIndex"])
                hotspot["title"] = match["title"]
                hotspot["images"] = match["outputImages"]
            else:
                hotspot["images"] = []
    return prepared


def main() -> None:
    scenes = scene_records()
    print(f"scenes: {len(scenes)}", flush=True)
    download_all(tile_jobs(scenes))
    for index, scene in enumerate(scenes, start=1):
        build_panorama(scene)
        if index % 10 == 0 or index == len(scenes):
            print(f"panoramas {index}/{len(scenes)}", flush=True)
    prepare_artworks(scenes)
    output_records = []
    for index, scene in enumerate(scenes):
        output_records.append({
            **scene,
            "index": index,
            "number": f"{index + 1:02d}",
            "panorama": f"{scene['id']}.jpg",
        })
    (OUTPUT / "gallery.json").write_text(json.dumps(output_records, ensure_ascii=False, indent=2), encoding="utf-8")
    panorama_bytes = sum(path.stat().st_size for path in (OUTPUT / "panoramas").glob("*.jpg"))
    artwork_bytes = sum(path.stat().st_size for path in (OUTPUT / "artworks").glob("*.jpg"))
    print(f"complete panoramas: {panorama_bytes / 1024 / 1024:.2f} MB", flush=True)
    print(f"complete artworks: {artwork_bytes / 1024 / 1024:.2f} MB", flush=True)


if __name__ == "__main__":
    main()
