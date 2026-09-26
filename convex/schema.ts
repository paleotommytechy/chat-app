import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaceSecrets: defineTable({
    fileEncryptionKey: v.string(),
    createdAt: v.number(),
  }),

  users: defineTable({
    displayName: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    token: v.string(),
    userId: v.optional(v.id("users")),
    displayName: v.string(),
    email: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_endpoint", ["endpoint"])
    .index("by_user", ["userId"]),

  messages: defineTable({
    sender: v.string(),
    senderUserId: v.optional(v.id("users")),
    channel: v.optional(
      v.union(v.literal("general"), v.literal("screenshots"), v.literal("files")),
    ),
    kind: v.union(v.literal("text"), v.literal("file"), v.literal("voice")),
    text: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    encrypted: v.optional(v.boolean()),
    durationMs: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),
});
