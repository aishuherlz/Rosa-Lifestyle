#!/bin/bash
cd /workspaces/Rosa-Lifestyle/artifacts/rosa-app
VITE_API_URL=https://workspaceapi-server-production-cc62.up.railway.app pnpm run build
netlify deploy --dir=/workspaces/Rosa-Lifestyle/artifacts/rosa-app/dist/public --prod --site=ab12d9fc-399d-428e-88f3-765eecfc7c5f --no-build
echo "🌹 ROSA deployed!"
