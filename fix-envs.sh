#!/usr/bin/env bash

# FIX PASTE_YOUR ENVS LOCALLY AND ON VERCEL
# Run from your project root

set -e

# 1) EDIT THESE TWO LINES WITH YOUR REAL KEYS BEFORE RUNNING
ODDS_KEY="YOUR_REAL_THE_ODDS_API_KEY"
OWM_KEY="YOUR_REAL_OPENWEATHERMAP_KEY"

# 2) Ensure .env.local exists and update values idempotently
touch .env.local
# Write or update variables
awk -v k1="$ODDS_KEY" -v k2="$OWM_KEY" '
BEGIN{
  found1=0; found2=0; found3=0;
}
$0 ~ /^ODDS_API_KEY=/       {print "ODDS_API_KEY="k1; found1=1; next}
$0 ~ /^OPENWEATHERMAP_API_KEY=/ {print "OPENWEATHERMAP_API_KEY="k2; found2=1; next}
$0 ~ /^NEXT_PUBLIC_SITE_NAME=/  {print "NEXT_PUBLIC_SITE_NAME=TheColdLine"; found3=1; next}
{print}
END{
  if(!found1) print "ODDS_API_KEY="k1;
  if(!found2) print "OPENWEATHERMAP_API_KEY="k2;
  if(!found3) print "NEXT_PUBLIC_SITE_NAME=TheColdLine";
}
' .env.local > .env.local.tmp && mv .env.local.tmp .env.local

echo "Local .env.local now set:"
grep -E '^(ODDS_API_KEY|OPENWEATHERMAP_API_KEY|NEXT_PUBLIC_SITE_NAME)=' .env.local | sed 's/=.*/=****/'

# 3) Push the same values to Vercel envs so production uses them
# Requires you to be logged in to Vercel and inside the correct project
printf "%s" "$ODDS_KEY" | npx vercel@latest env add ODDS_API_KEY production || true
printf "%s" "$ODDS_KEY" | npx vercel@latest env add ODDS_API_KEY preview || true
printf "%s" "$ODDS_KEY" | npx vercel@latest env add ODDS_API_KEY development || true

printf "%s" "$OWM_KEY" | npx vercel@latest env add OPENWEATHERMAP_API_KEY production || true
printf "%s" "$OWM_KEY" | npx vercel@latest env add OPENWEATHERMAP_API_KEY preview || true
printf "%s" "$OWM_KEY" | npx vercel@latest env add OPENWEATHERMAP_API_KEY development || true

printf "%s" "TheColdLine" | npx vercel@latest env add NEXT_PUBLIC_SITE_NAME production || true
printf "%s" "TheColdLine" | npx vercel@latest env add NEXT_PUBLIC_SITE_NAME preview || true
printf "%s" "TheColdLine" | npx vercel@latest env add NEXT_PUBLIC_SITE_NAME development || true

# 4) Clear Next cache locally and rebuild
rm -rf .next
npm run build

# 5) Quick local sanity checks if dev server is running
# You can start it with: npm run dev
echo "Local API sanity checks (ignore if dev server not running):"
curl -s http://localhost:3000/api/odds | head || true
curl -s "http://localhost:3000/api/weather?team=Chicago%20Bears" | head || true

# 6) Redeploy to Vercel production
npx vercel@latest --prod
echo "Done."

