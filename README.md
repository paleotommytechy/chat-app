# FriendSpace

A small private collaboration space for friends: realtime chat, screenshots, general file sharing, and safer `.env` sharing.

## Stack

- Next.js 16 + React 19
- Convex database, realtime subscriptions, sessions, and file storage
- Vercel hosting
- Web Crypto API for client-side AES-GCM encryption of `.env` files

## Features

- Shared private workspace protected by an access code
- Realtime group chat
- Drag-and-drop file uploads up to 25 MB
- Paste screenshots straight into the message composer
- Filters for all messages, files, and screenshots
- `.env`, `.env.*`, and `*.env` files encrypted before upload
- Responsive desktop/mobile UI

## Get started

See [CONVEX_SETUP.md](./CONVEX_SETUP.md) for the exact setup and Vercel deployment steps.

> Important: do not commit actual secrets or access codes to this repository. For highly sensitive production credentials, prefer a dedicated secret manager even though FriendSpace encrypts `.env` files before upload.
