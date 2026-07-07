import pandas as pd


ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
DEAD_ADDRESS = "0x000000000000000000000000000000000000dead"

BUCKETS = [
    ("0-1k", 0.0, 1_000.0),
    ("1k-10k", 1_000.0, 10_000.0),
    ("10k-100k", 10_000.0, 100_000.0),
    ("100k-1M", 100_000.0, 1_000_000.0),
    ("1M+", 1_000_000.0, None),
]


def _bucket_for_balance(balance):
    for label, low, high in BUCKETS:
        if balance >= low and (high is None or balance < high):
            return label
    return None


def _weighted_avg_age(rows):
    balance = float(rows["balance"].sum())
    if balance <= 0:
        return None
    return float((rows["balance"] * rows["avg_age"]).sum() / balance)


def _circulating_supply(metadata):
    return (
        float(metadata.get("total_minted_supply") or 0)
        - float(metadata.get("burned_supply") or 0)
        - float(metadata.get("dead_address_supply") or 0)
    )


def _excluded_reason(row, exchange_tx_threshold):
    address = str(row["address"]).lower()
    if address in {ZERO_ADDRESS, DEAD_ADDRESS}:
        return "burn/dead"
    if int(row.get("tx_in", 0)) > exchange_tx_threshold and int(row.get("tx_out", 0)) > exchange_tx_threshold:
        return "high activity"
    return None


def _normalise_snapshots(coin_age_snapshots):
    snapshots = coin_age_snapshots.copy() if coin_age_snapshots is not None else pd.DataFrame()
    if snapshots.empty:
        return snapshots
    snapshots["address"] = snapshots["address"].astype(str).str.lower()
    snapshots["week_start"] = pd.to_datetime(snapshots["week_start"])
    snapshots["balance"] = pd.to_numeric(snapshots["balance"], errors="coerce").fillna(0.0)
    snapshots["avg_age"] = pd.to_numeric(snapshots["avg_age"], errors="coerce").fillna(0.0)
    return snapshots


def _normalise_activity(wallet_activity):
    activity = wallet_activity.copy() if wallet_activity is not None else pd.DataFrame()
    if activity.empty:
        return activity
    activity["address"] = activity["address"].astype(str).str.lower()
    activity["balance"] = pd.to_numeric(activity["balance"], errors="coerce").fillna(0.0)
    activity["tx_in"] = pd.to_numeric(activity["tx_in"], errors="coerce").fillna(0).astype(int)
    activity["tx_out"] = pd.to_numeric(activity["tx_out"], errors="coerce").fillna(0).astype(int)
    return activity


def _excluded_wallets(activity, exchange_tx_threshold):
    if activity.empty:
        return pd.DataFrame(columns=["address", "balance", "tx_in", "tx_out", "reason"])
    candidates = activity.copy()
    candidates["reason"] = candidates.apply(lambda row: _excluded_reason(row, exchange_tx_threshold), axis=1)
    return candidates[
        candidates["reason"].notna()
        & (candidates["balance"] > 0)
        & (candidates["address"] != ZERO_ADDRESS)
    ].copy()


def _eligible_activity(activity, excluded_addresses):
    if activity.empty:
        return activity
    return activity[
        (activity["balance"] > 0)
        & (~activity["address"].isin(excluded_addresses))
        & (activity["address"] != ZERO_ADDRESS)
    ].copy()


def _wallet_event_balances_at(wallet_events, addresses, as_of):
    if wallet_events is None or wallet_events.empty:
        return pd.Series(dtype="float64")
    events = wallet_events.copy()
    events["address"] = events["address"].astype(str).str.lower()
    wanted = {str(addr).lower() for addr in addresses}
    events = events[events["address"].isin(wanted)].copy()
    if events.empty:
        return pd.Series(dtype="float64")
    events["_ts"] = pd.to_datetime(events["timestamp"], utc=True)
    events = events[events["_ts"] < pd.to_datetime(as_of, utc=True)].copy()
    if events.empty:
        return pd.Series(dtype="float64")
    events["amount"] = pd.to_numeric(events["amount"], errors="coerce").fillna(0.0)
    events["signed_amount"] = events["amount"].where(events["direction"] == "in", -events["amount"])
    return events.groupby("address")["signed_amount"].sum().clip(lower=0)


def validate_coin_age_snapshots(
    coin_age_snapshots,
    wallet_activity,
    wallet_events,
    metadata,
    exchange_tx_threshold=1000,
    balance_tolerance=1.0,
    balance_relative_tolerance=0.003,
    supply_pct_tolerance=0.05,
):
    snapshots = _normalise_snapshots(coin_age_snapshots)
    activity = _normalise_activity(wallet_activity)
    if snapshots.empty:
        raise ValueError("Coin age snapshots are empty")

    duplicates = snapshots.duplicated(subset=["address", "week_start"]).sum()
    if duplicates:
        raise ValueError(f"Coin age snapshots contain {duplicates:,} duplicate address/week rows")

    excluded = _excluded_wallets(activity, exchange_tx_threshold)
    excluded_addresses = set(excluded["address"])
    eligible = _eligible_activity(activity, excluded_addresses)

    circulating_supply = _circulating_supply(metadata or {})
    excluded_for_supply = excluded[excluded["address"] != DEAD_ADDRESS] if not excluded.empty else excluded
    included_balance = float(eligible["balance"].sum()) if not eligible.empty else 0.0
    excluded_balance = float(excluded_for_supply["balance"].sum()) if not excluded_for_supply.empty else 0.0
    if circulating_supply > 0:
        coverage_pct = (included_balance + excluded_balance) / circulating_supply * 100
        if abs(coverage_pct - 100.0) > supply_pct_tolerance:
            raise ValueError(f"Coin age supply coverage is {coverage_pct:.4f}%, expected about 100%")

    latest_week = snapshots["week_start"].max()
    latest_boundary = latest_week + pd.Timedelta(weeks=1)
    latest = snapshots[snapshots["week_start"] == latest_week].copy()
    latest = latest[~latest["address"].isin(excluded_addresses)]
    validation_addresses = latest["address"].drop_duplicates()
    if not eligible.empty:
        validation_addresses = pd.concat([validation_addresses, eligible["address"]]).drop_duplicates()
    expected = _wallet_event_balances_at(wallet_events, validation_addresses, latest_boundary)

    latest_by_address = latest.set_index("address")["balance"]
    all_addresses = latest_by_address.index.union(expected.index)
    balance_delta = latest_by_address.reindex(all_addresses, fill_value=0.0).sub(expected.reindex(all_addresses, fill_value=0.0))
    total_abs_delta = float(balance_delta.abs().sum())
    allowed_delta = max(balance_tolerance, float(expected.sum()) * balance_relative_tolerance)
    if total_abs_delta > allowed_delta:
        raise ValueError(
            f"Latest coin age snapshot differs from ledger-boundary balances by "
            f"{total_abs_delta:,.4f} TIBBIR, above allowed {allowed_delta:,.4f}"
        )

    dust_epsilon = 1e-6
    stale = latest_by_address[
        (latest_by_address > balance_tolerance + dust_epsilon)
        & (expected.reindex(latest_by_address.index, fill_value=0.0) <= balance_tolerance)
    ]
    if not stale.empty:
        raise ValueError(f"Latest coin age snapshot has {len(stale):,} positive-balance wallets that are zero at the ledger boundary")

    weekly_wallets = (
        snapshots[(snapshots["balance"] > balance_tolerance) & (~snapshots["address"].isin(excluded_addresses))]
        .groupby("week_start")["address"]
        .nunique()
        .sort_index()
    )
    previous = None
    for week, wallets in weekly_wallets.items():
        if previous is not None and previous > 1000 and wallets < previous * 0.70:
            raise ValueError(f"Coin age wallet coverage collapses at {week.date()}: {wallets:,} after {previous:,}")
        previous = wallets

    return True


def build_coin_age_dashboard_bundle(
    coin_age_snapshots,
    wallet_activity,
    metadata,
    exchange_tx_threshold=1000,
):
    """
    Build app-ready coin age history and coverage metrics.

    Coin age is weighted by the token balance included in each weekly snapshot.
    Excluded supply is limited to known coin-age exclusions: high-activity
    wallets and burn/dead/system addresses.
    """
    circulating_supply = _circulating_supply(metadata or {})

    snapshots = _normalise_snapshots(coin_age_snapshots)
    activity = _normalise_activity(wallet_activity)
    excluded = _excluded_wallets(activity, exchange_tx_threshold)
    excluded_addresses = set(excluded["address"])
    current_included = _eligible_activity(activity, excluded_addresses)
    current_included_balance = float(current_included["balance"].sum()) if not current_included.empty else 0.0
    current_included_wallets = int(current_included["address"].nunique()) if not current_included.empty else 0

    positive = snapshots[(snapshots["balance"] > 0) & (~snapshots["address"].isin(excluded_addresses))].copy()
    if positive.empty:
        latest_week = None
        history = []
        bucket_history = []
        included_balance = 0.0
        included_wallets = 0
        latest_avg_age = 0.0
        latest_snapshot_balance = 0.0
        latest_snapshot_wallets = 0
    else:
        positive["bucket"] = positive["balance"].apply(_bucket_for_balance)
        latest_week_ts = positive["week_start"].max()
        latest_week = latest_week_ts.strftime("%Y-%m-%d")
        latest = positive[positive["week_start"] == latest_week_ts]
        latest_snapshot_balance = float(latest["balance"].sum())
        latest_snapshot_wallets = int(latest["address"].nunique())
        included_balance = latest_snapshot_balance
        included_wallets = latest_snapshot_wallets
        latest_avg_age = _weighted_avg_age(latest) or 0.0

        history = []
        for week, group in positive.sort_values("week_start").groupby("week_start"):
            history.append({
                "weekStart": week.strftime("%Y-%m-%d"),
                "avgCoinAgeDays": _weighted_avg_age(group),
                "wallets": int(group["address"].nunique()),
                "balance": float(group["balance"].sum()),
            })

        bucket_history = []
        for week, group in positive.sort_values("week_start").groupby("week_start"):
            for bucket, _, _ in BUCKETS:
                bucket_group = group[group["bucket"] == bucket]
                bucket_history.append({
                    "weekStart": week.strftime("%Y-%m-%d"),
                    "bucket": bucket,
                    "avgCoinAgeDays": _weighted_avg_age(bucket_group) if not bucket_group.empty else None,
                    "wallets": int(bucket_group["address"].nunique()) if not bucket_group.empty else 0,
                    "balance": float(bucket_group["balance"].sum()) if not bucket_group.empty else 0.0,
                })

    excluded_for_supply = excluded[excluded["address"] != DEAD_ADDRESS] if not excluded.empty else excluded
    excluded_balance = float(excluded_for_supply["balance"].sum()) if not excluded_for_supply.empty else 0.0
    excluded_wallets = []
    if not excluded.empty:
        table = excluded.sort_values("balance", ascending=False).copy()
        table["supplySharePct"] = table["balance"] / circulating_supply * 100 if circulating_supply > 0 else 0.0
        excluded_wallets = table[["address", "balance", "tx_in", "tx_out", "reason", "supplySharePct"]].to_dict("records")

    return {
        "summary": {
            "latestWeekStart": latest_week,
            "avgCoinAgeDays": latest_avg_age,
            "includedBalance": current_included_balance or included_balance,
            "excludedBalance": excluded_balance,
            "includedSupplyPct": ((current_included_balance or included_balance) / circulating_supply * 100) if circulating_supply > 0 else 0.0,
            "excludedSupplyPct": (excluded_balance / circulating_supply * 100) if circulating_supply > 0 else 0.0,
            "includedWallets": current_included_wallets or included_wallets,
            "excludedWallets": int(len(excluded)),
            "circulatingSupply": circulating_supply,
            "latestSnapshotBalance": latest_snapshot_balance,
            "latestSnapshotWallets": latest_snapshot_wallets,
        },
        "buckets": [{"label": label} for label, _, _ in BUCKETS],
        "history": history,
        "bucketHistory": bucket_history,
        "excludedWallets": excluded_wallets,
    }
