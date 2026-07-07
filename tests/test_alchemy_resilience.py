import unittest
from unittest.mock import patch

from engine import update


class FakeResponse:
    def __init__(self, status_code, payload=None, headers=None):
        self.status_code = status_code
        self._payload = payload or {}
        self.headers = headers or {}

    def json(self):
        return self._payload

    @property
    def ok(self):
        return self.status_code < 400

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class AlchemyResilienceTests(unittest.TestCase):
    def test_iter_block_ranges_splits_inclusive_ranges(self):
        ranges = list(update._iter_block_ranges(10, 22, max_span=5))

        self.assertEqual(ranges, [(10, 14), (15, 19), (20, 22)])

    def test_post_alchemy_json_retries_rate_limits(self):
        responses = [
            FakeResponse(429, headers={"Retry-After": "0.01"}),
            FakeResponse(200, payload={"result": "ok"}),
        ]

        with patch.object(update.requests, "post", side_effect=responses) as post:
            with patch.object(update.time, "sleep") as sleep:
                with patch("builtins.print"):
                    result = update._post_alchemy_json(
                        "https://alchemy.example/rpc",
                        {"jsonrpc": "2.0", "method": "eth_blockNumber"},
                        context="test request",
                    )

        self.assertEqual(result, {"result": "ok"})
        self.assertEqual(post.call_count, 2)
        sleep.assert_called_once_with(0.01)

    def test_rate_limit_backoff_uses_slower_default_without_retry_after(self):
        response = FakeResponse(429)

        self.assertEqual(update._retry_delay(response, 0), 30.0)
        self.assertEqual(update._retry_delay(response, 1), 60.0)
        self.assertEqual(update._retry_delay(response, 2), 120.0)
        self.assertEqual(update._retry_delay(response, 3), 180.0)

    def test_transfer_log_rows_match_master_schema(self):
        from_address = "0x1111111111111111111111111111111111111111"
        to_address = "0x2222222222222222222222222222222222222222"
        tx_hash = "0xabc"
        log = {
            "address": "0xA4A2E2cA3FBFe21Aed83471D28B6f65A233C6e00",
            "blockNumber": "0x10",
            "transactionHash": tx_hash,
            "transactionIndex": "0x2",
            "logIndex": "0x5",
            "data": hex(123 * 10**18),
            "topics": [
                update._ERC20_TRANSFER_TOPIC,
                "0x" + "0" * 24 + from_address[2:],
                "0x" + "0" * 24 + to_address[2:],
            ],
        }

        rows = update._transfer_rows_from_logs([log], {16: "2026-07-07T09:00:00Z"})

        self.assertEqual(rows, [{
            "event_id": f"{tx_hash}:5",
            "block_number": 16,
            "timestamp": "2026-07-07T09:00:00Z",
            "tx_hash": tx_hash,
            "from_address": from_address,
            "to_address": to_address,
            "raw_amount": str(123 * 10**18),
            "decimals": 18,
            "amount": None,
            "contract_address": "0xa4a2e2ca3fbfe21aed83471d28b6f65a233c6e00",
            "category": "erc20",
            "asset": "TIBBIR",
        }])


if __name__ == "__main__":
    unittest.main()
