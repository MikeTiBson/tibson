# tibson

Public web app for Tibbir analytics on Base.

The backend starts from the Tibbir contract address:

```text
0xa4a2e2ca3fbfe21aed83471d28b6f65a233c6e00
```

Alchemy is used to fetch the full ERC-20 transaction history. The Python pipeline stores analytics outputs as Parquet in a private Google Cloud Storage bucket, then publishes private app-ready JSON bundles under `dashboard/*.json` for the Vercel frontend.

The public transaction dataset remains separate at:

```text
https://storage.googleapis.com/tibson-public
```

## App

The frontend lives in `apps/web` and is built with Next.js + TypeScript for Vercel.

Local development:

```bash
cd apps/web
npm ci
npm run dev
```

The web API reads private dashboard bundles from GCS. Configure one of:

- `GCP_SA_KEY` - service account JSON string
- `GOOGLE_APPLICATION_CREDENTIALS` - path to a service account JSON file
- `DASHBOARD_DATA_DIR` - local directory containing JSON bundles for offline UI work

Optional:

- `TIBBIR_GCS_BUCKET` - private bucket name, defaults to `tibbir-data`
- `TIBBIR_DASHBOARD_PREFIX` - bundle prefix, defaults to `dashboard`

## Pipeline

Run the full update pipeline:

```bash
python engine/run_daily.py
```

Run a single job:

```bash
python engine/run_job.py --job build_dashboard_bundles
```

The hourly GitHub Action runs the analytics pipeline, builds private dashboard bundles, and publishes the separate public transaction dataset.
