// @ts-nocheck
import { mutationGeneric, queryGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";
import { requireSession } from "./auth";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const MAX_VOICE_BYTES = 6 * 1024 * 1024;
const MAX_VOICE_DURATION_MS = 5 * 60 * 1000;

const channelValidator = v.union(
  v.literal("general"),
  v.literal("screenshots"),
  v.literal("files"),
);

function effectiveChannel(message: any) {
  if (message.channel) return message.channel;
  if (message.kind === "text" || message.kind === "voice") return "general";
  if (message.mimeType?.startsWith("image/")) return "screenshots";
  return "files";
}

function senderIdentity(session: any) {
  return session.userId ? { senderUserId: session.userId } : {};
}

function publicError(code: string, message: string) {
  return new ConvexError({ code, message });
}

export const list = queryGeneric({
  args: { token: v.string(), channel: channelValidator },
  handler: async (ctx, args) => {
    await requireSession(ctx, args.token);
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_createdAt")
      .order("desc")
      .take(300);

    const matching = rows
      .filter((message) => effectiveChannel(message) === args.channel)
      .slice(0, 150);

    const hydrated = await Promise.all(
      matching.map(async (message) => {
        const fileUrl = message.storageId
          ? await ctx.storage.getUrl(message.storageId)
          : null;

        return {
          ...message,
          channel: effectiveChannel(message),
          ...(fileUrl ? { fileUrl } : {}),
        };
      }),
    );

    return hydrated.reverse();
  },
});

export const sendText = mutationGeneric({
  args: { token: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    const text = args.text.trim();

    if (!text) return null;
    if (text.length > 5000) {
      throw publicError("MESSAGE_TOO_LONG", "Messages are limited to 5,000 characters.");
    }

    try {
      return await ctx.db.insert("messages", {
        sender: session.displayName,
        ...senderIdentity(session),
        channel: "general",
        kind: "text",
        text,
        createdAt: Date.now(),
      });
    } catch (error) {
      console.error("messages:sendText insert failed", error);
      throw publicError(
        "MESSAGE_SEND_FAILED",
        "Syncret couldn't send this message. Please try again.",
      );
    }
  },
});

export const generateUploadUrl = mutationGeneric({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireSession(ctx, args.token);
    return ctx.storage.generateUploadUrl();
  },
});

export const sendFile = mutationGeneric({
  args: {
    token: v.string(),
    channel: v.union(v.literal("screenshots"), v.literal("files")),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    encrypted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    const fileName = args.fileName.trim();
    if (!fileName) throw new Error("File name is required.");

    const isImage = args.mimeType.startsWith("image/");
    if (args.channel === "screenshots") {
      if (!isImage) {
        throw new Error("The Screenshots space only accepts images.");
      }
      if (args.encrypted) {
        throw new Error("Encrypted environment files belong in Files.");
      }
      if (args.fileSize <= 0 || args.fileSize > MAX_SCREENSHOT_BYTES) {
        throw new Error("Screenshots are limited to 8 MB.");
      }
    } else {
      if (isImage) {
        throw new Error("Images belong in the Screenshots space.");
      }
      if (args.fileSize <= 0 || args.fileSize > MAX_FILE_BYTES) {
        throw new Error("Files are limited to 10 MB.");
      }
    }

    return ctx.db.insert("messages", {
      sender: session.displayName,
      ...senderIdentity(session),
      channel: args.channel,
      kind: "file",
      storageId: args.storageId,
      fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType || "application/octet-stream",
      encrypted: args.encrypted,
      createdAt: Date.now(),
    });
  },
});

export const sendVoice = mutationGeneric({
  args: {
    token: v.string(),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    mimeType: v.string(),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    if (!args.mimeType.startsWith("audio/")) {
      throw new Error("Voice notes must be audio.");
    }
    if (args.fileSize <= 0 || args.fileSize > MAX_VOICE_BYTES) {
      throw new Error("Voice notes are limited to 6 MB.");
    }
    if (args.durationMs <= 0 || args.durationMs > MAX_VOICE_DURATION_MS) {
      throw new Error("Voice notes are limited to 5 minutes.");
    }

    return ctx.db.insert("messages", {
      sender: session.displayName,
      ...senderIdentity(session),
      channel: "general",
      kind: "voice",
      storageId: args.storageId,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      durationMs: args.durationMs,
      createdAt: Date.now(),
    });
  },
});

export const deleteMessage = mutationGeneric({
  args: { token: v.string(), messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    const message = await ctx.db.get(args.messageId);

    if (!message) return { deleted: false };
    if (!session.userId) {
      throw publicError(
        "SESSION_REFRESH_REQUIRED",
        "Please sign out and sign back in before deleting items.",
      );
    }
    if (!message.senderUserId || message.senderUserId !== session.userId) {
      throw publicError("DELETE_NOT_ALLOWED", "You can only delete items you sent.");
    }

    if (message.storageId) {
      try {
        await ctx.storage.delete(message.storageId);
      } catch {
        // The database row should still be removable if a stored blob is already gone.
      }
    }

    await ctx.db.delete(args.messageId);
    return { deleted: true };
  },
});
