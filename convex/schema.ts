import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    token: v.string(),
    displayName: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  messages: defineTable({
    sender: v.string(),
    kind: v.union(v.literal("text"), v.literal("file")),
    text: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    encrypted: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),
});
