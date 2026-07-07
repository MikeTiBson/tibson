import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config
from engine import update


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ[key.strip()] = value.strip().strip('"').strip("'")


def _json_default(value):
    return str(value)


def probe_transfers(rows: int, chunks: int, chunk_size: int, sleep: float) -> list[dict]:
    metadata = update._read_json(config.METADATA_FILE)
    start = int(metadata["end_block"]) - config.REORG_BUFFER
    safe_head = update._get_latest_block() - config.REORG_BUFFER

    print(json.dumps({
        "mode": "local_probe_only_no_writes",
        "metadata_end_block": int(metadata["end_block"]),
        "start_block": start,
        "safe_head": safe_head,
        "blocks_behind": safe_head - int(metadata["end_block"]),
        "chunk_size": chunk_size,
        "max_chunks": chunks,
        "stop_after_rows": rows,
    }, indent=2))

    found = []
    timestamp_cache = {}
    max_end = min(start + (chunks * chunk_size) - 1, safe_head)

    for chunk_index, (chunk_start, chunk_end) in enumerate(update._iter_block_ranges(start, max_end, max_span=chunk_size), start=1):
        t0 = time.time()
        chunk_rows = update._fetch_log_transfer_rows(chunk_start, chunk_end, timestamp_cache)
        elapsed_ms = round((time.time() - t0) * 1000, 1)
        found.extend(chunk_rows)
        print(json.dumps({
            "chunk": chunk_index,
            "range": f"{chunk_start}-{chunk_end}",
            "rows_in_chunk": len(chunk_rows),
            "total_rows": len(found),
            "known_timestamps": len(timestamp_cache),
            "elapsed_ms": elapsed_ms,
        }))
        if len(found) >= rows:
            break
        time.sleep(sleep)

    return found[:rows]


def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only probe for TIBBIR transfer logs. Does not write R2.")
    parser.add_argument("--rows", type=int, default=5, help="Stop after this many decoded transfer rows.")
    parser.add_argument("--chunks", type=int, default=20, help="Maximum chunks to scan.")
    parser.add_argument("--chunk-size", type=int, default=10, help="Blocks per eth_getLogs chunk.")
    parser.add_argument("--sleep", type=float, default=0.1, help="Seconds to sleep between chunks.")
    parser.add_argument("--env-file", default=".env", help="Optional .env file containing ALCHEMY_RPC_URL.")
    args = parser.parse_args()

    _load_dotenv(Path(args.env_file))
    rows = probe_transfers(rows=args.rows, chunks=args.chunks, chunk_size=args.chunk_size, sleep=args.sleep)
    print("sample_rows:")
    print(json.dumps(rows, indent=2, default=_json_default))


if __name__ == "__main__":
    main()
