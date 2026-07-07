import unittest

import pandas as pd

from analytics.coin_age_dashboard import build_coin_age_dashboard_bundle, validate_coin_age_snapshots


class CoinAgeDashboardTests(unittest.TestCase):
    def test_builds_weighted_history_buckets_and_exclusions(self):
        snapshots = pd.DataFrame([
            {
                "address": "0xa",
                "week_start": "2026-06-01",
                "balance": 100.0,
                "avg_age": 10.0,
            },
            {
                "address": "0xb",
                "week_start": "2026-06-01",
                "balance": 300.0,
                "avg_age": 20.0,
            },
            {
                "address": "0xzero",
                "week_start": "2026-06-01",
                "balance": 0.0,
                "avg_age": 999.0,
            },
            {
                "address": "0xa",
                "week_start": "2026-06-08",
                "balance": 2_000.0,
                "avg_age": 17.0,
            },
            {
                "address": "0xb",
                "week_start": "2026-06-08",
                "balance": 20_000.0,
                "avg_age": 27.0,
            },
            {
                "address": "0xexchange",
                "week_start": "2026-06-08",
                "balance": 500_000.0,
                "avg_age": 1.0,
            },
        ])
        activity = pd.DataFrame([
            {"address": "0xa", "balance": 2_000.0, "tx_in": 2, "tx_out": 1},
            {"address": "0xb", "balance": 20_000.0, "tx_in": 3, "tx_out": 1},
            {"address": "0xexchange", "balance": 500_000.0, "tx_in": 1001, "tx_out": 1002},
            {"address": "0x000000000000000000000000000000000000dead", "balance": 100_000.0, "tx_in": 1, "tx_out": 0},
        ])
        metadata = {
            "total_minted_supply": 1_000_000.0,
            "burned_supply": 100_000.0,
            "dead_address_supply": 100_000.0,
        }

        bundle = build_coin_age_dashboard_bundle(snapshots, activity, metadata, exchange_tx_threshold=1000)

        self.assertEqual(bundle["summary"]["latestWeekStart"], "2026-06-08")
        self.assertAlmostEqual(bundle["history"][0]["avgCoinAgeDays"], 17.5)
        self.assertAlmostEqual(bundle["history"][1]["avgCoinAgeDays"], (2_000 * 17 + 20_000 * 27) / 22_000)
        self.assertAlmostEqual(bundle["summary"]["avgCoinAgeDays"], (2_000 * 17 + 20_000 * 27) / 22_000)
        self.assertEqual(bundle["summary"]["includedWallets"], 2)
        self.assertAlmostEqual(bundle["summary"]["includedBalance"], 22_000.0)
        self.assertAlmostEqual(bundle["summary"]["excludedBalance"], 500_000.0)
        self.assertAlmostEqual(bundle["summary"]["includedSupplyPct"], 2.75)
        self.assertAlmostEqual(bundle["summary"]["excludedSupplyPct"], 62.5)

        latest_buckets = {
            row["bucket"]: row
            for row in bundle["bucketHistory"]
            if row["weekStart"] == "2026-06-08"
        }
        self.assertAlmostEqual(latest_buckets["1k-10k"]["avgCoinAgeDays"], 17.0)
        self.assertAlmostEqual(latest_buckets["10k-100k"]["avgCoinAgeDays"], 27.0)

        excluded = bundle["excludedWallets"]
        self.assertEqual([row["address"] for row in excluded], [
            "0xexchange",
            "0x000000000000000000000000000000000000dead",
        ])
        self.assertEqual(excluded[0]["reason"], "high activity")
        self.assertEqual(excluded[1]["reason"], "burn/dead")

    def test_validator_rejects_duplicate_wallet_weeks(self):
        snapshots = pd.DataFrame([
            {"address": "0xa", "week_start": "2026-06-01", "balance": 100.0, "avg_age": 10.0},
            {"address": "0xa", "week_start": "2026-06-01", "balance": 100.0, "avg_age": 12.0},
        ])
        activity = pd.DataFrame([{"address": "0xa", "balance": 100.0, "tx_in": 1, "tx_out": 0}])
        events = pd.DataFrame([{
            "address": "0xa",
            "timestamp": "2026-06-07T00:00:00Z",
            "direction": "in",
            "amount": 100.0,
        }])
        metadata = {"total_minted_supply": 1_000.0}

        with self.assertRaisesRegex(ValueError, "duplicate"):
            validate_coin_age_snapshots(snapshots, activity, events, metadata)

    def test_validator_excludes_dead_from_circulating_excluded_supply(self):
        snapshots = pd.DataFrame([{"address": "0xa", "week_start": "2026-06-01", "balance": 900.0, "avg_age": 7.0}])
        activity = pd.DataFrame([
            {"address": "0xa", "balance": 900.0, "tx_in": 1, "tx_out": 0},
            {"address": "0x000000000000000000000000000000000000dead", "balance": 100.0, "tx_in": 1, "tx_out": 0},
        ])
        events = pd.DataFrame([{
            "address": "0xa",
            "timestamp": "2026-06-07T00:00:00Z",
            "direction": "in",
            "amount": 900.0,
        }])
        metadata = {"total_minted_supply": 1_000.0, "dead_address_supply": 100.0}

        self.assertTrue(validate_coin_age_snapshots(snapshots, activity, events, metadata))

    def test_validator_rejects_stale_latest_balances(self):
        snapshots = pd.DataFrame([{"address": "0xa", "week_start": "2026-06-01", "balance": 100.0, "avg_age": 7.0}])
        activity = pd.DataFrame([{"address": "0xa", "balance": 100.0, "tx_in": 2, "tx_out": 1}])
        events = pd.DataFrame([
            {"address": "0xa", "timestamp": "2026-06-01T00:00:00Z", "direction": "in", "amount": 100.0},
            {"address": "0xa", "timestamp": "2026-06-07T00:00:00Z", "direction": "out", "amount": 100.0},
            {"address": "0xa", "timestamp": "2026-06-09T00:00:00Z", "direction": "in", "amount": 100.0},
        ])
        metadata = {"total_minted_supply": 100.0}

        with self.assertRaisesRegex(ValueError, "differs|positive-balance"):
            validate_coin_age_snapshots(snapshots, activity, events, metadata)

    def test_validator_allows_wallet_sold_after_latest_boundary(self):
        snapshots = pd.DataFrame([{"address": "0xa", "week_start": "2026-06-01", "balance": 100.0, "avg_age": 7.0}])
        activity = pd.DataFrame([{"address": "0xa", "balance": 0.0, "tx_in": 1, "tx_out": 1}])
        events = pd.DataFrame([
            {"address": "0xa", "timestamp": "2026-06-01T00:00:00Z", "direction": "in", "amount": 100.0},
            {"address": "0xa", "timestamp": "2026-06-09T00:00:00Z", "direction": "out", "amount": 100.0},
        ])
        metadata = {"total_minted_supply": 0.0}

        self.assertTrue(validate_coin_age_snapshots(snapshots, activity, events, metadata))

    def test_validator_allows_dust_level_floating_point_noise(self):
        snapshots = pd.DataFrame([{
            "address": "0xa",
            "week_start": "2026-06-01",
            "balance": 1.000000000003,
            "avg_age": 7.0,
        }])
        activity = pd.DataFrame([{"address": "0xa", "balance": 1.0, "tx_in": 1, "tx_out": 0}])
        events = pd.DataFrame([{
            "address": "0xa",
            "timestamp": "2026-06-01T00:00:00Z",
            "direction": "in",
            "amount": 0.999999999996,
        }])
        metadata = {"total_minted_supply": 0.0}

        self.assertTrue(validate_coin_age_snapshots(snapshots, activity, events, metadata))


if __name__ == "__main__":
    unittest.main()
