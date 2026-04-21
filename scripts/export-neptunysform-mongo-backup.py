from __future__ import annotations

import argparse
import gzip
import json
from datetime import datetime, timezone
from pathlib import Path

from bson.json_util import dumps
from pymongo import MongoClient


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export a Neptunysform Mongo database into gzipped JSONL collection files"
    )
    parser.add_argument("--uri", required=True, help="Mongo connection URI for the source database")
    parser.add_argument("--database", required=True, help="Database name to export")
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory where collection export files and manifest will be written"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Mongo cursor batch size while streaming documents (default: 500)"
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow writing into a non-empty output directory"
    )
    parser.add_argument(
        "--marker",
        help="Optional path to write a JSON summary after export completes"
    )
    return parser.parse_args()


def ensure_output_dir(path: Path, overwrite: bool) -> None:
    path.mkdir(parents=True, exist_ok=True)

    if overwrite:
        return

    existing_entries = list(path.iterdir())
    if existing_entries:
        raise SystemExit(
            f"Output directory {path} is not empty. Re-run with --overwrite to reuse it."
        )


def export_collection(collection, file_path: Path, batch_size: int) -> int:
    count = 0
    cursor = collection.find({}, no_cursor_timeout=True).batch_size(batch_size)

    try:
        with gzip.open(file_path, "wt", encoding="utf-8") as handle:
            for document in cursor:
                handle.write(dumps(document))
                handle.write("\n")
                count += 1
    finally:
        cursor.close()

    return count


def main() -> None:
    args = parse_args()

    if args.batch_size < 1:
        raise SystemExit("--batch-size must be at least 1")

    output_dir = Path(args.output_dir)
    ensure_output_dir(output_dir, args.overwrite)

    client = MongoClient(args.uri, serverSelectionTimeoutMS=10000)
    database = client[args.database]

    collection_names = sorted(database.list_collection_names())
    if not collection_names:
        raise SystemExit(f"Database {args.database} has no collections to export")

    manifest_entries: list[tuple[str, int, str]] = []

    for collection_name in collection_names:
        filename = f"{collection_name}.jsonl.gz"
        file_path = output_dir / filename
        exported_count = export_collection(database[collection_name], file_path, args.batch_size)
        manifest_entries.append((collection_name, exported_count, filename))

    manifest_path = output_dir / "manifest.txt"
    manifest_path.write_text(
        "\n".join(f"{name}\t{count}\t{filename}" for name, count, filename in manifest_entries)
        + "\n",
        encoding="utf-8"
    )

    summary = {
        "collections": {name: count for name, count, _ in manifest_entries},
        "database": args.database,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "outputDir": str(output_dir)
    }

    if args.marker:
        marker_path = Path(args.marker)
        marker_path.parent.mkdir(parents=True, exist_ok=True)
        marker_path.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")

    print(json.dumps({"ok": True, **summary}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()