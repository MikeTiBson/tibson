import sys
import argparse
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def _load_dotenv(path):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(Path(__file__).parent.parent / ".env")

from engine.update import (
    update_transfers,
    update_daily_holder_growth,
    update_daily_bucket_breakdown,
    rebuild_daily_holder_growth,
    rebuild_daily_bucket_breakdown,
    build_wallet_snapshot,
    build_wallet_activity,
    rebuild_coin_age_snapshots,
    update_coin_age_snapshots,
    build_wallet_events,
    build_wallet_summary,
    build_wallet_profiler,
    rebuild_price_history,
    update_price_history,
    build_soulbound_holder_supply,
    build_chad_cohorts,
    build_dashboard_bundles,
)

JOBS = {
    "update_transfers":           lambda: update_transfers(),
    "update_holder_growth":       lambda: update_daily_holder_growth(),
    "update_bucket_breakdown":    lambda: update_daily_bucket_breakdown(),
    "rebuild_holder_growth":      lambda: rebuild_daily_holder_growth(),
    "rebuild_bucket_breakdown":   lambda: rebuild_daily_bucket_breakdown(),
    "build_wallet_snapshot":      lambda: build_wallet_snapshot(),
    "build_wallet_activity":      lambda: build_wallet_activity(),
    "rebuild_coin_age_snapshots": lambda: rebuild_coin_age_snapshots(),
    "update_coin_age_snapshots":  lambda: update_coin_age_snapshots(),
    "build_wallet_events":        lambda: build_wallet_events(),
    "build_wallet_summary":       lambda: build_wallet_summary(),
    "build_wallet_profiler":      lambda: build_wallet_profiler(),
    "rebuild_price_history":      lambda: rebuild_price_history(),
    "update_price_history":       lambda: update_price_history(),
    "build_soulbound_holder_supply": lambda: build_soulbound_holder_supply(),
    "build_chad_cohorts":         lambda: build_chad_cohorts(),
    "build_dashboard_bundles":    lambda: build_dashboard_bundles(),
}

parser = argparse.ArgumentParser()
parser.add_argument("--job", required=True, choices=list(JOBS))
parser.add_argument("--transfer-max-blocks", type=int, help="Limit update_transfers to this many blocks.")
parser.add_argument("--transfer-dry-run", action="store_true", help="Run update_transfers merge/invariants without writing outputs.")
args = parser.parse_args()

if args.transfer_max_blocks is not None:
    os.environ["TRANSFER_UPDATE_MAX_BLOCKS"] = str(args.transfer_max_blocks)
if args.transfer_dry_run:
    os.environ["TRANSFER_UPDATE_DRY_RUN"] = "1"

print(f"=== {args.job} ===")
print(JOBS[args.job]())
