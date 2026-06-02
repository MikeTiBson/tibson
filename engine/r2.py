import json
import os
import re
from pathlib import Path
from typing import Any

import boto3
from botocore.client import BaseClient


def _value(record: dict[str, Any], *names: str) -> str | None:
    for name in names:
        value = record.get(name)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _parse_example_usage(text: str) -> dict[str, str | None]:
    def find(*patterns: str) -> str | None:
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    return {
        "access_key_id": find(r"AWS_ACCESS_KEY_ID=([^\s]+)", r"Access Key ID\s*[:=]\s*([^\s]+)"),
        "endpoint": find(r"(https://[^\s'\"]+\.r2\.cloudflarestorage\.com)"),
        "secret_access_key": find(r"AWS_SECRET_ACCESS_KEY=([^\s]+)", r"Secret Access Key\s*[:=]\s*([^\s]+)"),
    }


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _load_local_config_file() -> dict[str, str | None]:
    candidates = [
        os.environ.get("R2_CONFIG_FILE"),
        str(Path.cwd() / "R2.json"),
        str(Path.cwd() / "R2 User Token.json"),
        str(Path.cwd().parent / "R2.json"),
        str(Path.cwd().parent / "R2 User Token.json"),
        str(_repo_root() / "R2.json"),
        str(_repo_root() / "R2 User Token.json"),
    ]
    config_path = next((Path(path) for path in candidates if path and Path(path).exists()), None)
    if not config_path:
        return {}

    data = json.loads(config_path.read_text(encoding="utf-8"))
    example = _parse_example_usage(_value(data, "Example usage", "exampleUsage") or "")
    account_id = _value(data, "account ID", "accountId", "R2_ACCOUNT_ID")
    return {
        "access_key_id": _value(data, "Access Key ID", "accessKeyId", "R2_ACCESS_KEY_ID") or example["access_key_id"],
        "bucket": _value(data, "Bucket", "bucket", "R2_BUCKET"),
        "endpoint": (
            _value(data, "Default", "S3 API", "endpoint", "R2_ENDPOINT")
            or example["endpoint"]
            or (f"https://{account_id}.r2.cloudflarestorage.com" if account_id else None)
        ),
        "secret_access_key": _value(data, "Secret Access Key", "secretAccessKey", "R2_SECRET_ACCESS_KEY") or example["secret_access_key"],
    }


def load_r2_config() -> dict[str, str] | None:
    local = _load_local_config_file()
    access_key_id = os.environ.get("R2_ACCESS_KEY_ID") or local.get("access_key_id")
    secret_access_key = os.environ.get("R2_SECRET_ACCESS_KEY") or local.get("secret_access_key")
    endpoint = os.environ.get("R2_ENDPOINT") or local.get("endpoint")

    if not access_key_id and not secret_access_key:
        return None
    if not access_key_id or not secret_access_key or not endpoint:
        raise RuntimeError("R2 is configured but missing Access Key ID, Secret Access Key, or endpoint")

    return {
        "access_key_id": access_key_id,
        "bucket": os.environ.get("R2_BUCKET") or local.get("bucket") or "tibson-data",
        "endpoint": endpoint,
        "dashboard_prefix": os.environ.get("R2_DASHBOARD_PREFIX") or "dashboard",
        "smoke_prefix": os.environ.get("R2_SMOKE_PREFIX") or "smoke",
        "prefix": os.environ.get("R2_DASHBOARD_PREFIX") or "dashboard",
        "secret_access_key": secret_access_key,
    }


def r2_client(config: dict[str, str] | None = None) -> BaseClient:
    resolved = config or load_r2_config()
    if not resolved:
        raise RuntimeError("R2 credentials are not configured")
    return boto3.client(
        "s3",
        aws_access_key_id=resolved["access_key_id"],
        aws_secret_access_key=resolved["secret_access_key"],
        endpoint_url=resolved["endpoint"],
        region_name="auto",
    )


def parse_r2_uri(uri: str) -> tuple[str, str]:
    if not uri.startswith("r2://"):
        raise ValueError(f"Not an R2 URI: {uri}")
    bucket, _, key = uri[5:].partition("/")
    if not bucket or not key:
        raise ValueError(f"Invalid R2 URI: {uri}")
    return bucket, key


def read_r2_json(uri: str) -> Any:
    return json.loads(read_r2_bytes(uri).decode("utf-8"))


def write_r2_json(data: Any, uri: str) -> None:
    body = json.dumps(data, indent=2).encode("utf-8")
    write_r2_bytes(body, uri, content_type="application/json")


def read_r2_bytes(uri: str) -> bytes:
    bucket, key = parse_r2_uri(uri)
    response = r2_client().get_object(Bucket=bucket, Key=key)
    return response["Body"].read()


def write_r2_bytes(body: bytes, uri: str, content_type: str = "application/octet-stream") -> None:
    bucket, key = parse_r2_uri(uri)
    r2_client().put_object(Bucket=bucket, Key=key, Body=body, ContentType=content_type)


def r2_exists(uri: str) -> bool:
    bucket, key = parse_r2_uri(uri)
    try:
        r2_client().head_object(Bucket=bucket, Key=key)
        return True
    except Exception as exc:
        response = getattr(exc, "response", {})
        status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        code = response.get("Error", {}).get("Code")
        if status == 404 or code in {"404", "NoSuchKey", "NotFound"}:
            return False
        raise
