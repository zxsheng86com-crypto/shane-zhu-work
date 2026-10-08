#!/bin/sh
# Upload public/media to a Cloudflare R2 bucket via rclone (S3 API).
#
# One-time setup:
#   brew install rclone
#   rclone config   →  New remote → name: r2 → type: s3 → provider: Cloudflare
#                      access_key_id / secret: R2 API token (Cloudflare 面板 → R2 → Manage API Tokens)
#                      endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
#
# Usage: sh scripts/upload-media-r2.sh [bucket-name]   (default: portfolio-media)
set -eu

BUCKET="${1:-portfolio-media}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/public/media"

rclone sync "$DIR" "r2:$BUCKET/media" \
  --header-upload "Cache-Control: public, max-age=31536000, immutable" \
  --transfers 16 --checkers 16 --progress

echo "Done. ${BUCKET}/media is in sync with ${DIR}"
