from __future__ import annotations

import base64
import json
import mimetypes
import os
import shutil
import sqlite3
import tempfile
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse


ADMIN_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ADMIN_ROOT.parent
DATASET_ROOT = PROJECT_ROOT / "dataset"
STATIC_ROOT = ADMIN_ROOT / "static"
DB_PATH = ADMIN_ROOT / "content.db"

SECTIONS = {
    "current": {"label": "当前展览", "sources": [("dataset/current_exhibition/exhibitions.json", [])]},
    "reviews": {"label": "展览回顾", "sources": [("dataset/exhibition_review/exhibitions.json", [])]},
    "artists": {"label": "艺术家", "sources": [("dataset/artists.json", [])]},
    "artworks": {"label": "藏品", "glob": "dataset/artworks/*/metadata.json"},
    "news": {"label": "新闻讯息", "sources": [("dataset/news/news.json", [])]},
    "previews": {"label": "展览预告", "sources": [("dataset/official_programs/exhibition_previews/data.json", ["items"])]},
    "lectures": {"label": "讲座", "sources": [("dataset/official_programs/lectures/data.json", ["reservations"]), ("dataset/official_programs/lectures/data.json", ["reviews"])]},
    "activities": {"label": "活动", "sources": [("dataset/official_programs/activities/data.json", ["items"])]},
    "virtual-scenes": {"label": "数字展厅", "sources": [("dataset/virtual_gallery/scenes.json", [])]},
    "virtual-artworks": {"label": "数字展厅作品", "sources": [("dataset/virtual_gallery/artworks.json", [])]},
}

TEMPLATES = {
    "current": {"type": "当前展览", "title": "新展览", "cover_image": "", "local_image": "", "time": "", "location": "", "organizer": "", "intro": ""},
    "reviews": {"type": "展览回顾", "title": "新展览回顾", "cover_image": "", "time": "", "location": "", "organizer": "", "intro": "", "works": []},
    "artists": {"name": "新艺术家", "birth": "", "identity": "", "style": "", "field": "", "representative_works": [], "intro": ""},
    "news": {"type": "画院新闻", "title": "新新闻", "date": datetime.now().strftime("%Y-%m-%d"), "content": [], "images": [], "local_images": [], "source": ""},
    "previews": {"id": "preview-new", "title": "新展览预告", "publishDate": "", "time": "", "location": "", "summary": "", "statusText": "敬请期待", "reservable": False},
    "activities": {"id": "activity-new", "title": "新活动", "publishDate": "", "time": "", "location": "", "summary": "", "statusText": "开放预约", "reservable": True},
    "virtual-scenes": {"scene": "scene_new", "title": "新场景", "preview": "", "cube": ""},
    "virtual-artworks": {"scene": "scene_new", "title": "新作品", "image": ""},
}


def db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.execute(
        "CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY, action TEXT NOT NULL, section TEXT NOT NULL, path TEXT NOT NULL, title TEXT, created_at TEXT NOT NULL)"
    )
    connection.execute("CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC)")
    connection.execute("PRAGMA optimize")
    connection.commit()
    return connection


def safe_project_path(relative: str) -> Path:
    candidate = (PROJECT_ROOT / relative).resolve()
    if candidate != PROJECT_ROOT and PROJECT_ROOT not in candidate.parents:
        raise ValueError("路径超出项目目录")
    return candidate


def read_json(relative: str):
    return json.loads(safe_project_path(relative).read_text(encoding="utf-8"))


def get_bucket(document, bucket: list[str]):
    value = document
    for key in bucket:
        value = value[key]
    if not isinstance(value, list):
        raise ValueError("目标数据不是列表")
    return value


def encode_token(path: str, bucket: list[str], index: int, section: str) -> str:
    raw = json.dumps({"p": path, "b": bucket, "i": index, "s": section}, ensure_ascii=False).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_token(token: str) -> dict:
    padding = "=" * (-len(token) % 4)
    return json.loads(base64.urlsafe_b64decode(token + padding).decode("utf-8"))


def sources_for(section: str):
    spec = SECTIONS[section]
    if "glob" in spec:
        return [(path.relative_to(PROJECT_ROOT).as_posix(), []) for path in sorted(PROJECT_ROOT.glob(spec["glob"]))]
    return spec["sources"]


def item_title(record: dict) -> str:
    return str(record.get("title") or record.get("name") or record.get("scene") or record.get("id") or "未命名内容")


def item_subtitle(record: dict, relative: str) -> str:
    bits = [record.get("artist"), record.get("time"), record.get("date"), record.get("location"), record.get("kind"), record.get("type")]
    text = " · ".join(str(bit) for bit in bits if bit)
    if text:
        return text
    if "/artworks/" in relative:
        return Path(relative).parent.name
    return Path(relative).name


def media_candidate(record: dict, relative: str) -> str:
    source_dir = safe_project_path(relative).parent
    candidates = []
    for key in ("local_image", "preview", "cover_image", "image"):
        value = record.get(key)
        if isinstance(value, str) and value and not value.startswith(("http://", "https://")):
            candidates.append(value)
    local_images = record.get("local_images")
    if isinstance(local_images, list):
        candidates.extend(value for value in local_images if isinstance(value, str))
    for value in candidates:
        possibilities = [source_dir / value, PROJECT_ROOT / value.lstrip("/"), DATASET_ROOT / value]
        for path in possibilities:
            try:
                resolved = path.resolve()
                if resolved.is_file() and (resolved == PROJECT_ROOT or PROJECT_ROOT in resolved.parents):
                    return resolved.relative_to(PROJECT_ROOT).as_posix()
            except (OSError, ValueError):
                continue
    if "/exhibition_review/exhibitions.json" in relative:
        cover = DATASET_ROOT / "exhibition_review" / item_title(record) / "cover.jpg"
        if cover.is_file():
            return cover.relative_to(PROJECT_ROOT).as_posix()
    return ""


def all_records(section: str) -> list[dict]:
    records = []
    for relative, bucket in sources_for(section):
        try:
            document = read_json(relative)
            items = get_bucket(document, bucket) if bucket else document
            if isinstance(items, dict):
                items = [items]
            if not isinstance(items, list):
                continue
            for index, record in enumerate(items):
                if not isinstance(record, dict):
                    continue
                records.append({
                    "id": encode_token(relative, bucket, index, section),
                    "title": item_title(record),
                    "subtitle": item_subtitle(record, relative),
                    "source": relative,
                    "image": media_candidate(record, relative),
                    "record": record,
                })
        except (OSError, ValueError, json.JSONDecodeError, KeyError):
            continue
    return records


def backup_file(path: Path) -> None:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    relative = path.relative_to(PROJECT_ROOT)
    target = ADMIN_ROOT / "backups" / stamp / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)


def write_json(relative: str, document) -> None:
    path = safe_project_path(relative)
    backup_file(path)
    payload = json.dumps(document, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=path.parent, suffix=".tmp") as handle:
        handle.write(payload)
        temp_name = handle.name
    os.replace(temp_name, path)


def log_action(action: str, section: str, path: str, title: str) -> None:
    with db() as connection:
        connection.execute(
            "INSERT INTO audit_log(action, section, path, title, created_at) VALUES (?, ?, ?, ?, ?)",
            (action, section, path, title, datetime.now().isoformat(timespec="seconds")),
        )


def mutate_record(token: str, replacement: dict | None, delete: bool = False):
    location = decode_token(token)
    relative, bucket, index, section = location["p"], location["b"], int(location["i"]), location["s"]
    document = read_json(relative)
    items = get_bucket(document, bucket) if bucket else document
    if not isinstance(items, list) or index < 0 or index >= len(items):
        raise ValueError("记录已不存在，请刷新列表")
    previous = items[index]
    title = item_title(previous if isinstance(previous, dict) else {})
    if delete:
        items.pop(index)
        action = "删除"
    else:
        if not isinstance(replacement, dict):
            raise ValueError("记录格式不正确")
        items[index] = replacement
        title = item_title(replacement)
        action = "更新"
    write_json(relative, document)
    log_action(action, section, relative, title)


def add_record(section: str):
    if section not in TEMPLATES:
        raise ValueError("该分类暂不支持直接新增")
    relative, bucket = sources_for(section)[0]
    document = read_json(relative)
    items = get_bucket(document, bucket) if bucket else document
    if not isinstance(items, list):
        raise ValueError("该数据文件暂不支持新增")
    record = json.loads(json.dumps(TEMPLATES[section], ensure_ascii=False))
    items.insert(0, record)
    write_json(relative, document)
    log_action("新增", section, relative, item_title(record))
    return encode_token(relative, bucket, 0, section)


def export_snapshot() -> Path:
    payload = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "sections": {section: [entry["record"] for entry in all_records(section)] for section in SECTIONS},
    }
    exports = ADMIN_ROOT / "exports"
    exports.mkdir(parents=True, exist_ok=True)
    target = exports / "miniprogram-content.json"
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log_action("导出", "all", target.relative_to(PROJECT_ROOT).as_posix(), "小程序内容快照")
    return target


class Handler(SimpleHTTPRequestHandler):
    server_version = "BFAA-CMS/1.0"

    def log_message(self, format, *args):
        return

    def send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

    def do_GET(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        try:
            if parsed.path == "/api/summary":
                counts = {key: len(all_records(key)) for key in SECTIONS}
                with db() as connection:
                    recent = [dict(zip(("action", "section", "path", "title", "createdAt"), row)) for row in connection.execute("SELECT action, section, path, title, created_at FROM audit_log ORDER BY id DESC LIMIT 8")]
                self.send_json({"counts": counts, "recent": recent, "sections": {key: value["label"] for key, value in SECTIONS.items()}})
                return
            if parsed.path == "/api/records":
                section = query.get("section", ["current"])[0]
                search = query.get("q", [""])[0].strip().lower()
                if section not in SECTIONS:
                    raise ValueError("未知内容分类")
                records = all_records(section)
                if search:
                    records = [item for item in records if search in (item["title"] + " " + item["subtitle"]).lower()]
                self.send_json({"section": section, "label": SECTIONS[section]["label"], "records": records, "canAdd": section in TEMPLATES})
                return
            if parsed.path == "/api/record":
                token = query.get("id", [""])[0]
                location = decode_token(token)
                document = read_json(location["p"])
                items = get_bucket(document, location["b"]) if location["b"] else document
                self.send_json({"record": items[int(location["i"])], "source": location["p"], "section": location["s"]})
                return
            if parsed.path == "/media":
                relative = unquote(query.get("path", [""])[0])
                path = safe_project_path(relative)
                if not path.is_file():
                    self.send_error(HTTPStatus.NOT_FOUND)
                    return
                data = path.read_bytes()
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "public, max-age=300")
                self.end_headers()
                self.wfile.write(data)
                return
            if parsed.path == "/" or parsed.path == "":
                self.path = "/index.html"
            return SimpleHTTPRequestHandler.do_GET(self)
        except Exception as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            body = self.read_body()
            if parsed.path == "/api/records":
                token = add_record(str(body.get("section", "")))
                self.send_json({"ok": True, "id": token}, HTTPStatus.CREATED)
                return
            if parsed.path == "/api/export":
                target = export_snapshot()
                self.send_json({"ok": True, "path": target.relative_to(PROJECT_ROOT).as_posix()})
                return
            self.send_error(HTTPStatus.NOT_FOUND)
        except Exception as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)

    def do_PUT(self):
        try:
            body = self.read_body()
            mutate_record(str(body.get("id", "")), body.get("record"))
            self.send_json({"ok": True})
        except Exception as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        try:
            token = parse_qs(parsed.query).get("id", [""])[0]
            mutate_record(token, None, delete=True)
            self.send_json({"ok": True})
        except Exception as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)

    def translate_path(self, path: str) -> str:
        clean = urlparse(path).path.lstrip("/") or "index.html"
        return str((STATIC_ROOT / clean).resolve())


def main():
    db().close()
    host, port = "127.0.0.1", 8787
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"北京画院内容管理后台：http://{host}:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
