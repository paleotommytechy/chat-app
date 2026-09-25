# FriendSpace setup

This repository now contains a Next.js + Convex version of the chat app at the repository root. The older `client/` and `server/` folders are kept for history but are no longer used by the new deployment.

## 1. Install dependencies

```bash
npm install
```

## 2. Create/connect the Convex project

```bash
npx convex dev
```

Choose/create the Convex project when prompted. This writes `CONVEX_DEPLOYMENT` plus `NEXT_PUBLIC_CONVEX_URL` to `.env.local` and also generates Convex helper types. FriendSpace uses Convex's supported `anyApi` / generic server APIs so the very first Vercel build does not depend on generated files already being committed.

## 3. Set the private workspace access code

Use a long random value and share it with friends through a separate trusted channel.

```bash
npx convex env set WORKSPACE_ACCESS_CODE "replace-this-with-a-long-random-code"
```

Do **not** commit the code to GitHub and do not prefix it with `NEXT_PUBLIC_`.

## 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

## 5. Deploy to Vercel

Import this GitHub repository into Vercel. Add a production Convex deploy key as `CONVEX_DEPLOY_KEY` in Vercel project environment variables. The included `vercel-build` script deploys Convex functions first and then builds Next.js.

For the production Convex deployment, also set `WORKSPACE_ACCESS_CODE` in Convex's production environment.

## Security notes

- Every app query/mutation validates a workspace session token.
- `.env`, `.env.*`, and `*.env` files are encrypted in the browser with AES-GCM before upload. Convex only stores ciphertext for those files.
- Convex file URLs are bearer URLs. Normal files and screenshots are only handed to authenticated workspace sessions, but someone who receives a copied file URL can reuse it. Sensitive `.env` files remain encrypted even if that URL leaks.
- For highly sensitive production credentials, a dedicated secrets manager is still safer than chat/file sharing.
