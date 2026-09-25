// @ts-nocheck
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const SESSION_LIFETIME = 1000 * 60 * 60 * 24 * 14;

type SessionCtx = any;

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

export const login = mutationGeneric({
  args: {
    displayName: v.string(),
    accessCode: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.WORKSPACE_ACCESS_CODE;
    if (!expected) {
      throw new Error("WORKSPACE_ACCESS_CODE is not configured in Convex.");
    }

    const displayName = args.displayName.trim();
    if (displayName.length < 2 || displayName.length > 40) {
      throw new Error("Use a display name between 2 and 40 characters.");
    }
    if (args.token.length < 30 || args.accessCode !== expected) {
      throw new Error("Invalid workspace access code.");
    }

    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (existing) await ctx.db.delete(existing._id);

    await ctx.db.insert("sessions", {
      token: args.token,
      displayName,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_LIFETIME,
    });

    return { displayName };
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
    return { displayName: session.displayName, expiresAt: session.expiresAt };
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
