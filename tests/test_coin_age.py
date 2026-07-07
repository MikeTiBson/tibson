import unittest

import pandas as pd

from analytics.coin_age import build_weekly_snapshots_from_wallet_events


class WalletEventCoinAgeTests(unittest.TestCase):
    def test_incoming_only_ages_to_latest_completed_week(self):
        events = pd.DataFrame([{
            "address": "0xa",
            "event_id": "1:0",
            "block_number": 1,
            "timestamp": "2026-06-01T00:00:00Z",
            "direction": "in",
            "amount": 100.0,
        }])

        snapshots = build_weekly_snapshots_from_wallet_events("0xa", events, as_of="2026-06-17T12:00:00Z")

        self.assertEqual(snapshots["week_start"].astype(str).tolist(), ["2026-06-01", "2026-06-08"])
        self.assertAlmostEqual(float(snapshots.iloc[-1]["balance"]), 100.0)
        self.assertAlmostEqual(float(snapshots.iloc[-1]["avg_age"]), 14.0)

    def test_outgoing_destroys_proportional_coin_days(self):
        events = pd.DataFrame([
            {
                "address": "0xa",
                "event_id": "1:0",
                "block_number": 1,
                "timestamp": "2026-06-01T00:00:00Z",
                "direction": "in",
                "amount": 100.0,
            },
            {
                "address": "0xa",
                "event_id": "2:0",
                "block_number": 2,
                "timestamp": "2026-06-08T00:00:00Z",
                "direction": "out",
                "amount": 50.0,
            },
        ])

        snapshots = build_weekly_snapshots_from_wallet_events("0xa", events, as_of="2026-06-17T12:00:00Z")

        self.assertAlmostEqual(float(snapshots.iloc[-1]["balance"]), 50.0)
        self.assertAlmostEqual(float(snapshots.iloc[-1]["avg_age"]), 14.0)

    def test_watermark_limits_projection_to_completed_weeks(self):
        events = pd.DataFrame([{
            "address": "0xa",
            "event_id": "1:0",
            "block_number": 1,
            "timestamp": "2026-06-01T00:00:00Z",
            "direction": "in",
            "amount": 100.0,
        }])

        snapshots = build_weekly_snapshots_from_wallet_events("0xa", events, as_of="2026-06-10T12:00:00Z")

        self.assertEqual(snapshots["week_start"].astype(str).tolist(), ["2026-06-01"])
        self.assertAlmostEqual(float(snapshots.iloc[-1]["avg_age"]), 7.0)


if __name__ == "__main__":
    unittest.main()
