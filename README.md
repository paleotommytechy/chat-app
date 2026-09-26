# Syncret

Syncret is a small private realtime workspace for developers to communicate without mixing chat, screenshots, and project files together.

## Stack

- Next.js 16 + React 19
- Convex for realtime data, user accounts, sessions, file storage, voice notes, and ownership checks
- Web Crypto API for client-side AES-GCM encryption of sensitive environment files
- Vercel-compatible frontend deployment

## Spaces

### General

- Text chat
- Voice notes up to 5 minutes
- No document or screenshot uploads

### Screenshots

- Images only
- Upload, drag-and-drop, or paste directly from the clipboard
- Up to 8 MB per image
- Intended for bugs, UI issues, logs shown visually, and other screen context

### Files

- Small project/config/document files
- Examples: `.env`, `AGENTS.md`, configs, snippets, and documents
- Images are rejected and belong in Screenshots
- Up to 10 MB per file
- `.env`, `.env.*`, and `*.env` files are encrypted before upload

## Other features

- Email/password account creation and sign in
- Realtime updates through Convex
- Sender-only deletion enforced by the backend
- Browser push notifications for new messages, voice notes, screenshots, and files
- Notification clicks reopen Syncret in the relevant space
- Persistent or session-only login with Remember Me
- Responsive desktop/mobile interface

## Environment variables

Syncret expects this frontend environment variable:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

For local development, `npx convex dev` normally writes this value into `.env.local`.

For a Vercel deployment, add `NEXT_PUBLIC_CONVEX_URL` in the Vercel project's Environment Variables settings. Use the Convex deployment URL you want that Vercel environment to talk to.

No workspace encryption secret is required in Vercel: Syncret provisions and stores the shared file-encryption key inside the authenticated Convex backend.

### Push notification environment variables

Push delivery is sent by Convex, so these variables belong on the **Convex deployment**, not in Vercel:

```env
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your-contact@example.com
PUSH_DISPATCH_SECRET=
```

Generate the VAPID key pair after installing dependencies:

```powershell
npm run vapid:generate
```

Generate a random dispatch secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the four variables on the development Convex deployment with `npx convex env set ...`, and set the same variable names on production with `npx convex env --prod set ...`.

Keep the private key and dispatch secret out of GitHub and Vercel. The VAPID public key is returned to authenticated Syncret clients by Convex when they enable notifications.

## Local development

Run Convex in one terminal:

```powershell
npx convex dev
```

Run Next.js in another terminal:

```powershell
npm run dev -- -p 3002
```

Then open `http://localhost:3002`.

Voice recording requires microphone permission. Push notifications require notification permission plus a service worker. Both work on secure origins such as HTTPS; browser development support also permits service workers on `localhost`.

Syncret only asks for notification permission after the user clicks **Enable alerts**. Push notifications are suppressed while a Syncret window is already visible, because the realtime UI is already active.

## Deployment workflow

Changes are pushed to GitHub `main`. Deploy the frontend from GitHub using your own Vercel project. The assistant does not deploy Syncret directly to Vercel.

> For highly sensitive production credentials, a dedicated secrets manager is still safer than sharing credentials through any chat application.
