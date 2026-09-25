# DevCache

DevCache is a small private realtime workspace for developers to communicate without mixing chat, screenshots, and project files together.

## Stack

- Next.js 16 + React 19
- Convex for realtime data, user accounts, sessions, file storage, and ownership checks
- Vercel hosting
- Web Crypto API for client-side AES-GCM encryption of sensitive environment files

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
- Persistent or session-only login with Remember Me
- Responsive desktop/mobile interface

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

Voice recording requires microphone permission. It works on secure origins such as Vercel HTTPS and on `localhost`.

> For highly sensitive production credentials, a dedicated secrets manager is still safer than sharing credentials through any chat application.
