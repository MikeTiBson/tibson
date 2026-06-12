import unittest

import pandas as pd

from analytics.chads import build_chad_wallets


class ChadWalletAgeTests(unittest.TestCase):
    def test_current_coin_age_uses_ledger_watermark(self):
        as_of = pd.Timestamp("2026-06-12T00:00:00Z")
        address = "0xabc0000000000000000000000000000000000000"
        pool = "0xdef0000000000000000000000000000000000000"

        wallet_events = pd.DataFrame([
            {
                "address": address,
                "event_id": "100:0",
                "block_number": 100,
                "timestamp": (as_of - pd.Timedelta(days=2)).isoformat(),
                "direction": "in",
                "counterparty": pool,
                "raw_amount": str(20_000 * 10**18),
                "amount": 20_000.0,
            },
            {
                "address": pool,
                "event_id": "101:0",
                "block_number": 101,
                "timestamp": as_of.isoformat(),
                "direction": "in",
                "counterparty": address,
                "raw_amount": "1",
                "amount": 0.0,
            },
        ])
        wallet_summary = pd.DataFrame([
            {
                "address": address,
                "balance": 20_000.0,
                "tx_in": 1,
                "tx_out": 0,
                "total_received": 20_000.0,
                "total_sent": 0.0,
                "first_block": 100,
                "last_block": 100,
                "first_ts": as_of - pd.Timedelta(days=2),
                "last_ts": as_of - pd.Timedelta(days=2),
            }
        ])

        wallets = build_chad_wallets(wallet_events, wallet_summary, known_addresses={})

        self.assertEqual(len(wallets), 1)
        self.assertAlmostEqual(float(wallets.loc[0, "avg_coin_age_days"]), 2.0)


if __name__ == "__main__":
    unittest.main()
