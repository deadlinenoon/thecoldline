#!/usr/bin/env bash
set -euo pipefail

KEEP="${1:-https://thecoldline-7tvo4292e-deadlinenoons-projects.vercel.app}"

echo "Building locally..."
rm -rf .next
npm run build

echo "Deploying local build (prebuilt)..."
npx vercel deploy --prebuilt --prod --yes

echo "If anything looks off, re-alias domains back to KEEP:"
echo "  npx vercel alias set \"$KEEP\" www.thecoldline.com"
echo "  npx vercel alias set \"$KEEP\" thecoldline.com"
