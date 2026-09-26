// @ts-nocheck
import { mutationGeneric, queryGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";
import { requireSession } from "./auth";

function requirePushIdentity(session: any) {
  if (!session.userId) {
    throw new ConvexError({
      code: "SESSION_REFRESH_REQUIRED",
      message: "Please sign out and sign back in before enabling notifications.",
    });
  }
  return session.userId;
}

function dispatchSecretMatches(value: string) {
  const expected = process.env.PUSH_DISPATCH_SECRET;
  return Boolean(expected && value && expected === value);
}

export const config = queryGeneric({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireSession(ctx, args.token);
    const publicKey = process.env.VAPID_PUBLIC_KEY ?? null;
    return {
      enabled: Boolean(
        publicKey &&
          process.env.VAPID_PRIVATE_KEY &&
          process.env.VAPID_SUBJECT &&
          process.env.PUSH_DISPATCH_SECRET,
      ),
      publicKey,
    };
  },
});

export const register = mutationGeneric({
  args: {
    token: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    const userId = requirePushIdentity(session);

    if (!args.endpoint.startsWith("https://")) {
      throw new ConvexError({
        code: "INVALID_PUSH_SUBSCRIPTION",
        message: "The browser returned an invalid push subscription.",
      });
    }

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId,
        p256dh: args.p256dh,
        auth: args.auth,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("pushSubscriptions", {
      userId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const unregister = mutationGeneric({
  args: {
    token: v.string(),
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    const userId = requirePushIdentity(session);

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();

    if (existing && existing.userId === userId) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});

export const deliveryTargets = queryGeneric({
  args: {
    dispatchSecret: v.string(),
    senderUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    if (!dispatchSecretMatches(args.dispatchSecret)) {
      throw new ConvexError({
        code: "PUSH_NOT_ALLOWED",
        message: "Push delivery is not authorized.",
      });
    }

    const rows = await ctx.db.query("pushSubscriptions").collect();

    return rows
      .filter((row) => row.userId !== args.senderUserId)
      .map((row) => ({
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      }));
  },
});
