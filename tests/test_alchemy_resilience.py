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


if __name__ == "__main__":
    unittest.main()
