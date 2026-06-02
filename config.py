import os

CONTRACT_ADDRESS = "0xa4a2e2ca3fbfe21aed83471d28b6f65a233c6e00".lower()

CHAIN = "base"
ALCHEMY_PRICE_NETWORK = "base-mainnet"
VIRTUAL_ADDRESS = "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b".lower()
TIBBIR_VIRTUAL_PAIR_ADDRESS = "0x0c3b466104545efa096b8f944c1e524e1d0d4888".lower()

REORG_BUFFER = 200

MAX_COUNT_HEX = "0x3e8"  # 1000 per request

R2_BUCKET = os.environ.get("R2_BUCKET", "tibson-data")
R2_DASHBOARD_PREFIX = os.environ.get("R2_DASHBOARD_PREFIX", "dashboard").strip("/")
R2_DASHBOARD_URI = f"r2://{R2_BUCKET}/{R2_DASHBOARD_PREFIX}"

RAW_TRANSFERS_URI = f"r2://{R2_BUCKET}/raw/transfers"
INDEXED_WALLETS_URI = f"r2://{R2_BUCKET}/indexed/wallets"
DERIVED_HOLDERS_URI = f"r2://{R2_BUCKET}/derived/holders"
DERIVED_CHADS_URI = f"r2://{R2_BUCKET}/derived/chads"
DERIVED_PRICE_URI = f"r2://{R2_BUCKET}/derived/price"
DERIVED_COIN_AGE_URI = f"r2://{R2_BUCKET}/derived/coin-age"
ARCHIVE_WALLETS_URI = f"r2://{R2_BUCKET}/archive/wallets"

MASTER_FILE = f"{RAW_TRANSFERS_URI}/tibbir_transfers_master.parquet"
METADATA_FILE = f"{RAW_TRANSFERS_URI}/tibbir_metadata.json"
RECENT_TRANSFERS_FILE = f"{RAW_TRANSFERS_URI}/tibbir_recent_transfers.parquet"
DAILY_HOLDER_GROWTH_FILE = f"{DERIVED_HOLDERS_URI}/daily_holder_growth.parquet"
DAILY_BUCKET_BREAKDOWN_FILE = f"{DERIVED_HOLDERS_URI}/daily_bucket_breakdown.parquet"
WALLET_SNAPSHOT_FILE = f"{DERIVED_HOLDERS_URI}/tibbir_wallet_snapshot.parquet"
WALLET_ACTIVITY_FILE    = f"{INDEXED_WALLETS_URI}/tibbir_wallet_activity.parquet"
COIN_AGE_SNAPSHOTS_FILE = f"{DERIVED_COIN_AGE_URI}/tibbir_coin_age_snapshots.parquet"
WALLET_EVENTS_FILE      = f"{INDEXED_WALLETS_URI}/tibbir_wallet_events.parquet"
WALLET_SUMMARY_FILE     = f"{INDEXED_WALLETS_URI}/tibbir_wallet_summary.parquet"
WALLET_PROFILER_FILE    = f"{ARCHIVE_WALLETS_URI}/tibbir_wallet_profiler.parquet"
PRICE_HISTORY_FILE      = f"{DERIVED_PRICE_URI}/tibbir_price_history.parquet"
CHAD_COHORTS_FILE       = f"{DERIVED_CHADS_URI}/tibbir_chad_cohorts.parquet"
CHAD_WALLETS_FILE       = f"{DERIVED_CHADS_URI}/tibbir_chad_wallets.parquet"
SOULBOUND_NFT_HOLDERS_CSV = "data/Tibbir-SoulboundNFT-0xcabce1fa75aca96b40cc98dd3ab38ba332d9e488.csv"
SOULBOUND_HOLDER_SUPPLY_FILE = f"{DERIVED_HOLDERS_URI}/tibbir_soulbound_holder_supply.parquet"
DASHBOARD_JSON_PREFIX = R2_DASHBOARD_URI
