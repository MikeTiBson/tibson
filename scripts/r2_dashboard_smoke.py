import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine.r2 import load_r2_config, r2_client


def _r2_key(prefix: str, name: str) -> str:
    return f"{prefix.rstrip('/')}/{name}.json"


def smoke_test() -> dict[str, str]:
    config = load_r2_config()
    if not config:
        raise RuntimeError("R2 credentials are not configured. Add S3 Access Key ID and Secret Access Key to R2.json or env vars.")

    client = r2_client(config)
    key = _r2_key(config["smoke_prefix"], "r2-smoke-test")
    payload = {
        "ok": True,
        "source": "scripts/r2_dashboard_smoke.py",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    client.put_object(
        Bucket=config["bucket"],
        Key=key,
        Body=json.dumps(payload).encode("utf-8"),
        ContentType="application/json",
    )
    response = client.get_object(Bucket=config["bucket"], Key=key)
    loaded = json.loads(response["Body"].read().decode("utf-8"))
    if loaded.get("ok") is not True:
        raise RuntimeError("R2 smoke-test object did not round-trip correctly")
    return {"bucket": config["bucket"], "key": key}


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke-test R2 dashboard JSON access.")
    parser.parse_args()

    smoke = smoke_test()
    print(f"R2 smoke test ok: r2://{smoke['bucket']}/{smoke['key']}")


if __name__ == "__main__":
    main()
