from __future__ import annotations

import argparse
import json
from typing import Any

from pymongo import MongoClient


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare collection document counts between two Mongo databases"
    )
    parser.add_argument("--source-uri", required=True, help="Mongo connection URI for the source database")
    parser.add_argument("--source-database", required=True, help="Source database name")
    parser.add_argument("--target-uri", required=True, help="Mongo connection URI for the target database")
    parser.add_argument("--target-database", required=True, help="Target database name")
    parser.add_argument(
        "--marker",
        help="Optional path to write the comparison result as JSON"
    )
    return parser.parse_args()


def collection_counts(database) -> dict[str, int]:
    counts: dict[str, int] = {}

    for collection_name in sorted(database.list_collection_names()):
        counts[collection_name] = database[collection_name].count_documents({})

    return counts


def build_result(source_counts: dict[str, int], target_counts: dict[str, int]) -> dict[str, Any]:
    collections = sorted(set(source_counts) | set(target_counts))
    mismatches = []

    for collection_name in collections:
        source_count = source_counts.get(collection_name, 0)
        target_count = target_counts.get(collection_name, 0)

        if source_count != target_count:
            mismatches.append(
                {
                    "collection": collection_name,
                    "sourceCount": source_count,
                    "targetCount": target_count
                }
            )

    return {
        "ok": len(mismatches) == 0,
        "sourceCollections": source_counts,
        "targetCollections": target_counts,
        "mismatches": mismatches
    }


def main() -> None:
    args = parse_args()

    source_client = MongoClient(args.source_uri, serverSelectionTimeoutMS=10000)
    target_client = MongoClient(args.target_uri, serverSelectionTimeoutMS=10000)

    source_counts = collection_counts(source_client[args.source_database])
    target_counts = collection_counts(target_client[args.target_database])
    result = build_result(source_counts, target_counts)

    if args.marker:
        with open(args.marker, 'w', encoding='utf-8') as handle:
            json.dump(result, handle, indent=2, sort_keys=True)

    print(json.dumps(result, indent=2, sort_keys=True))

    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()