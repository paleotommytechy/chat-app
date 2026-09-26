"use node";
// @ts-nocheck
import * as webpush from "web-push";
import { actionGeneric, anyApi } from "convex/server";
import { ConvexError, v } from "convex/values";

const kindValidator = v.union(
  v.literal("text"),
  v.literal("voice"),
  v.literal("file"),
  v.literal("screenshot"),
);

const channelValidator = v.union(
  v.literal("general"),
  v.literal("screenshots"),
  v.literal("files"),
);

export const send = actionGeneric({
  args: {
    dispatchSecret: v.string(),
    senderUserId: v.id("users"),
    senderName: v.string(),
    messageId: v.id("messages"),
    kind: kindValidator,
    channel: channelValidator,
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.PUSH_DISPATCH_SECRET;
    if (!expectedSecret || args.dispatchSecret !== expectedSecret) {
      throw new ConvexError({
        code: "PUSH_NOT_ALLOWED",
        message: "Push delivery is not authorized.",
      });
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
      console.warn("Syncret push skipped: VAPID environment variables are incomplete.");
      return { sent: 0, failed: 0, skipped: true };
    }

    const targets = await ctx.runQuery(anyApi.notifications.deliveryTargets, {
      dispatchSecret: args.dispatchSecret,
      senderUserId: args.senderUserId,
    });

    if (!targets.length) {
      return { sent: 0, failed: 0, skipped: false };
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const label =
      args.kind === "voice"
        ? "voice note"
        : args.kind === "screenshot"
          ? "screenshot"
          : args.kind === "file"
            ? "file"
            : "message";

    const payload = JSON.stringify({
      title: `New ${label} from ${args.senderName}`,
      body:
        args.channel === "general"
          ? `${args.senderName} sent a ${label} in #general.`
          : `${args.senderName} shared a ${label} in #${args.channel}.`,
      url: `/?space=${args.channel}`,
      tag: `syncret-${args.messageId}`,
      kind: args.kind,
      channel: args.channel,
    });

    const results = await Promise.allSettled(
      targets.map((target: any) =>
        webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: {
              p256dh: target.p256dh,
              auth: target.auth,
            },
          },
          payload,
          {
            TTL: 120,
            urgency: "high",
          },
        ),
      ),
    );

    let sent = 0;
    let failed = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        sent += 1;
      } else {
        failed += 1;
        console.warn("Syncret push delivery failed", result.reason);
      }
    }

    return { sent, failed, skipped: false };
  },
});
