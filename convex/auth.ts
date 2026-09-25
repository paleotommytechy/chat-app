// @ts-nocheck
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const SESSION_LIFETIME = 1000 * 60 * 60 * 24 * 14;
const HASH_ITERATIONS = 240_000;

type SessionCtx = any;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: HASH_ITERATIONS },
    material,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function createSession(ctx: SessionCtx, user: any, token: string) {
  if (token.length < 30) throw new Error("Invalid session token.");
  const existing = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (existing) await ctx.db.delete(existing._id);

  await ctx.db.insert("sessions", {
    token,
    userId: user._id,
    displayName: user.displayName,
    email: user.email,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_LIFETIME,
  });
}

export async function requireSession(ctx: SessionCtx, token: string) {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Your session has expired. Please sign in again.");
  }
  return session;
}

export const signup = mutationGeneric({
  args: {
    displayName: v.string(),
    email: v.string(),
    password: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const displayName = args.displayName.trim();
    const email = normalizeEmail(args.email);
    if (displayName.length < 2 || displayName.length > 40) {
      throw new Error("Use a name between 2 and 40 characters.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (args.password.length < 8 || args.password.length > 128) {
      throw new Error("Password must be between 8 and 128 characters.");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) throw new Error("An account already exists with this email.");

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordHash = await derivePasswordHash(args.password, salt);
    const userId = await ctx.db.insert("users", {
      displayName,
      email,
      passwordHash,
      passwordSalt: bytesToBase64(salt),
      createdAt: Date.now(),
    });
    const user = await ctx.db.get(userId);
    await createSession(ctx, user, args.token);
    return { displayName, email };
  },
});

export const login = mutationGeneric({
  args: {
    email: v.string(),
    password: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (!user) throw new Error("Incorrect email or password.");
    const actual = await derivePasswordHash(args.password, base64ToBytes(user.passwordSalt));
    if (!safeEqual(actual, user.passwordHash)) {
      throw new Error("Incorrect email or password.");
    }

    await createSession(ctx, user, args.token);
    return { displayName: user.displayName, email: user.email };
  },
});

export const session = queryGeneric({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!session || session.expiresAt < Date.now()) return null;
    return {
      displayName: session.displayName,
      email: session.email,
      expiresAt: session.expiresAt,
    };
  },
});

export const fileEncryptionKey = queryGeneric({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireSession(ctx, args.token);
    return process.env.FILE_ENCRYPTION_KEY ?? null;
  },
});

export const logout = mutationGeneric({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});
