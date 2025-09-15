# Ops quick flip
Emergency steps to restore last known good
1. List deployments
   npm run vercel:ls
2. Instant rollback to previous prod
   npx vercel rollback
3. Promote a specific deployment to prod
   npx vercel promote https://thecoldline-xxxxxx.vercel.app
4. From source tag if needed
   git fetch --all
   git checkout $(git tag -l 'prod-*' | tail -n1)
   npx vercel --prod

