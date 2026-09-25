import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireSession } from "./auth";

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireSession(ctx, args.token);
    const rows = await ctx.db.query("messages").withIndex("by_createdAt").order("desc").take(150);

    const hydrated = await Promise.all(
      rows.map(async (message) => ({
        ...message,
        fileUrl: message.storageId ? await ctx.storage.getUrl(message.storageId) : undefined,
      })),
    );

    return hydrated.reverse();
  },
});

export const sendText = mutation({
  args: { token: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    const text = args.text.trim();
    if (!text) return null;
    if (text.length > 5000) throw new Error("Message is too long.");

    return ctx.db.insert("messages", {
      sender: session.displayName,
      kind: "text",
      text,
      createdAt: Date.now(),
    });
  },
});

export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireSession(ctx, args.token);
    return ctx.storage.generateUploadUrl();
  },
});

export const sendFile = mutation({
  args: {
    token: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    encrypted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.token);
    if (!args.fileName.trim()) throw new Error("File name is required.");
    if (args.fileSize < 0 || args.fileSize > 25 * 1024 * 1024) {
      throw new Error("Files are limited to 25 MB in this workspace.");
    }

    return ctx.db.insert("messages", {
      sender: session.displayName,
      kind: "file",
      storageId: args.storageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType || "application/octet-stream",
      encrypted: args.encrypted,
      createdAt: Date.now(),
    });
  },
});
