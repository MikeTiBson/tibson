# tibson

Public web app for Tibbir analytics on Base.

The backend starts from the Tibbir contract address:

```text
0xa4a2e2ca3fbfe21aed83471d28b6f65a233c6e00
```

Alchemy is used to fetch the full ERC-20 transaction history. The Python pipeline stores private analytics outputs as Parquet in Cloudflare R2, then publishes private app-ready JSON bundles under `dashboard/*.json` for the Vercel frontend.

Public transaction dataset downloads are currently paused.

## App

The frontend lives in `apps/web` and is built with Next.js + TypeScript for Vercel.

Local development:

```bash
npm --prefix apps/web ci
npm --prefix apps/web run dev -- --hostname 127.0.0.1 --port 3000
```

The web API reads private dashboard bundles from Cloudflare R2. Configure:

- `R2_ENDPOINT` - account endpoint, such as `https://<account_id>.r2.cloudflarestorage.com`
- `R2_BUCKET` - bucket name, defaults to `tibson-data`
- `R2_DASHBOARD_PREFIX` - dashboard bundle prefix, defaults to `dashboard`
- `R2_ACCESS_KEY_ID` - R2 S3 access key ID
- `R2_SECRET_ACCESS_KEY` - R2 S3 secret access key

Optional:

- `DASHBOARD_DATA_DIR` - local directory containing JSON bundles for offline UI work

Local development may also load R2 credentials from ignored root files such as `R2.json` or `R2 User Token.json`.

## Pipeline

Run the full update pipeline:

```bash
python engine/run_daily.py
```

Run a single job:

```bash
python engine/run_job.py --job build_dashboard_bundles
```

Private pipeline artifacts use:

- `R2_BUCKET` - bucket name, defaults to `tibson-data`
- `R2_DASHBOARD_PREFIX` - dashboard bundle prefix, defaults to `dashboard`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`

R2 private artifact layout:

```text
raw/transfers/
indexed/wallets/
derived/holders/
derived/chads/
derived/price/
derived/coin-age/
archive/wallets/
dashboard/
smoke/
```

GitHub Actions workflows are currently disabled while the storage migration is verified.
