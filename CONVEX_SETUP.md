# Syncret setup

Syncret uses Next.js for the frontend and Convex for authentication, realtime messages, file storage, screenshots, voice notes, ownership checks, and browser push delivery.

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

## 4. Configure browser push notifications

Install the new dependency after pulling the notification feature:

```bash
npm install
```

Generate one VAPID key pair:

```bash
npm run vapid:generate
```

Generate a separate random internal dispatch secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set these values on your development Convex deployment:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
PUSH_DISPATCH_SECRET
```

For example, use `VAPID_SUBJECT=mailto:your-contact@example.com`.

To keep private values out of shell history, run commands such as:

```powershell
npx convex env set VAPID_PRIVATE_KEY
npx convex env set PUSH_DISPATCH_SECRET
```

and paste the values when prompted.

Set the equivalent variables on production using the `--prod` deployment option:

```powershell
npx convex env --prod set VAPID_PUBLIC_KEY
npx convex env --prod set VAPID_PRIVATE_KEY
npx convex env --prod set VAPID_SUBJECT
npx convex env --prod set PUSH_DISPATCH_SECRET
```

These are **Convex** environment variables. Do not add the private VAPID key or dispatch secret to Vercel.

Users opt in from the bell control in Syncret. The browser then stores a Web Push subscription in Convex. When another authenticated user sends a text message, voice note, screenshot, or file, Convex sends a push to the subscribed browsers of the other users.

Push notifications deliberately do not include the actual chat message or file contents, so private developer content is not exposed on a device lock screen.

## 5. Deploy the Convex backend you want to use

## 4. Deploy the Convex backend you want to use

For a production backend, deploy Convex separately from the frontend:

```bash
npx convex deploy
```

Use the resulting production Convex client URL for the production frontend.

## 6. Deploy the frontend yourself

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
- Push subscriptions are tied to authenticated Syncret user IDs.
- Push delivery excludes every subscription belonging to the sender.
- VAPID private material remains only in Convex environment variables.
- General is restricted to text and voice notes.
- Screenshots is restricted to images.
- Files is for small non-image project/config/document files.
- `.env`, `.env.*`, and `*.env` files are encrypted in the browser before upload.
- Convex storage URLs are bearer URLs, so highly sensitive production credentials still belong in a dedicated secrets manager.
