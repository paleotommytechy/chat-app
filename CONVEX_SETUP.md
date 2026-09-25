# Syncret setup

Syncret uses Next.js for the frontend and Convex for authentication, realtime messages, file storage, screenshots, voice notes, and ownership checks.

The older `client/` and `server/` folders are historical and are not used by the current root application.

## 1. Install dependencies

```bash
npm install
```

## 2. Connect the Convex project

```bash
npx convex dev
```

Choose the correct Convex project when prompted.

Convex writes values like these to `.env.local`:

```env
CONVEX_DEPLOYMENT=...
NEXT_PUBLIC_CONVEX_URL=https://your-development-deployment.convex.cloud
```

It also watches the `convex/` directory and publishes backend function changes while it is running.

## 3. Run Syncret locally

Keep `npx convex dev` running in one terminal.

In a second terminal:

```bash
npm run dev -- -p 3002
```

Open:

```text
http://localhost:3002
```

Voice notes require microphone permission. Browser microphone access works on `localhost` and secure HTTPS origins.

## 4. Deploy the Convex backend you want to use

For a production backend, deploy Convex separately from the frontend:

```bash
npx convex deploy
```

Use the resulting production Convex client URL for the production frontend.

## 5. Deploy the frontend yourself

Syncret's repository is pushed to GitHub `main`. Import or connect that repository in your own Vercel project.

Add this Vercel environment variable:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-production-deployment.convex.cloud
```

That is the only Vercel environment variable currently required by the Syncret frontend.

You do not need `WORKSPACE_ACCESS_CODE`: Syncret now uses individual email/password accounts.

You also do not need a file-encryption secret in Vercel. Syncret generates the shared encryption key in the authenticated Convex backend.

## Security notes

- Every protected query and mutation validates a Syncret session.
- Message deletion is checked by Convex and only the original authenticated sender can delete their item.
- General is restricted to text and voice notes.
- Screenshots is restricted to images.
- Files is for small non-image project/config/document files.
- `.env`, `.env.*`, and `*.env` files are encrypted in the browser before upload.
- Convex storage URLs are bearer URLs, so highly sensitive production credentials still belong in a dedicated secrets manager.
