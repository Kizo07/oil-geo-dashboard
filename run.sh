#!/usr/bin/env bash
set -euo pipefail

ENV_PY="/opt/anaconda/envs/oilgeo/bin/python"
if [ ! -x "$ENV_PY" ]; then
  echo "conda env 'oilgeo' not found. Create it with:"
  echo "  conda env create -f environment.yml"
  exit 1
fi

# Load optional API keys (EIA_API_KEY, AISSTREAM_API_KEY) from backend/.env.
ENV_FILE="$(dirname "$0")/backend/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

cd "$(dirname "$0")/backend"
exec "$ENV_PY" -m uvicorn app:app --host 127.0.0.1 --port 8787
