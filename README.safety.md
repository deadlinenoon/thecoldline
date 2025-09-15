Safety net
- Every push to main creates prod-YYYYMMDD-HHMM tag and a GitHub Release
- Nightly job saves a source tarball artifact for 14 days
- Use vercel rollback or Promote to flip instantly
How to flip fast
- npm run vercel:ls
- npx vercel rollback
- npx vercel promote <deployment-url>
From a tag
- git checkout latest prod-* tag
- npx vercel --prod

