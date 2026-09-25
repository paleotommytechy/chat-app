# DevCache

DevCache is a private realtime collaboration space for developers to chat, paste screenshots, share files, and exchange encrypted `.env` files.

## Stack

- Next.js 16 + React 19
- Convex for realtime data, user accounts, sessions, and file storage
- Vercel hosting
- Web Crypto API for client-side AES-GCM encryption of sensitive environment files

## Features

- Email/password account creation and sign in
- Realtime shared developer chat
- Drag-and-drop file uploads up to 25 MB
- Paste screenshots directly into the message composer
- Filters for messages, files, and screenshots
- `.env`, `.env.*`, and `*.env` files encrypted before upload
- Responsive desktop/mobile interface
- Persistent or session-only login with Remember Me

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

> For highly sensitive production credentials, a dedicated secrets manager is still safer than sharing credentials through any chat application.
