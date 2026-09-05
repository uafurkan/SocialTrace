/**
 * Postgres schema (Drizzle ORM) for the canonical domain model in spec §31.
 * Mirrors the field-by-field mapping already documented in
 * docs/DATA_MODEL.md. Nothing in src/app or src/lib/providers imports this
 * yet — the mock provider keeps serving the UI (see docs/DECISIONS.md).
 */
import {
  bigint,
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", ["instagram"]);
export const mediaTypeEnum = pgEnum("media_type", ["image", "video", "reel"]);
export const membershipKindEnum = pgEnum("membership_kind", ["follower", "following"]);
export const membershipEventEnum = pgEnum("membership_event", ["added", "removed"]);
/** Spec §31's plan model, trimmed to what's enforceable without real billing — see docs/BILLING.md. */
export const planEnum = pgEnum("plan", ["free", "pro"]);

/** Future `profiles` table — see docs/DATA_MODEL.md "Profile" mapping. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: platformEnum("platform").notNull(),
    username: text("username").notNull(),
    normalizedUsername: text("normalized_username").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url").notNull().default(""),
    isVerified: boolean("is_verified").notNull().default(false),
    isPrivate: boolean("is_private").notNull().default(false),
    followerCount: bigint("follower_count", { mode: "number" }).notNull().default(0),
    followingCount: bigint("following_count", { mode: "number" }).notNull().default(0),
    postCount: bigint("post_count", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** Unique, not just indexed, so a snapshot capture can upsert by (platform, normalized_username) — see src/lib/snapshot/capture.ts. */
    platformNormalizedUsernameIdx: uniqueIndex("profiles_platform_normalized_username_idx").on(
      table.platform,
      table.normalizedUsername,
    ),
  }),
);

/**
 * Future `social_users` table — identities distinct from a specific
 * profile's follower/following membership (spec §31). Deduped by
 * (platform, normalized_username), unlike the mock provider which
 * generates fresh fake users per (profileId, kind).
 */
export const socialUsers = pgTable(
  "social_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: platformEnum("platform").notNull(),
    username: text("username").notNull(),
    normalizedUsername: text("normalized_username").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url").notNull().default(""),
    isVerified: boolean("is_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** Unique so follower/following capture can upsert by (platform, normalized_username) instead of duplicating identities every snapshot. */
    platformNormalizedUsernameIdx: uniqueIndex("social_users_platform_normalized_username_idx").on(
      table.platform,
      table.normalizedUsername,
    ),
  }),
);

/**
 * Cost-control cache for `provider.getProfile` (see
 * src/lib/cache/profile-cache.ts): every profile lookup — a plain search,
 * not just an explicit "Track"/snapshot action — upserts a row here.
 * Within `PROFILE_CACHE_TTL_HOURS` (docs/DECISIONS.md), the next lookup of
 * the same profile is served from `data` instead of re-hitting the real
 * provider, which is what actually costs money (Apify bills per call).
 * `data` is the exact `Profile` object the provider returned — cached
 * verbatim rather than reconstructed from columns, since coverage fields
 * are provider-specific derived values, not something this cache should
 * try to recompute.
 */
export const profileCache = pgTable(
  "profile_cache",
  {
    platform: platformEnum("platform").notNull(),
    normalizedUsername: text("normalized_username").notNull(),
    data: jsonb("data").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.platform, table.normalizedUsername] }),
  }),
);

/**
 * Future `follower_memberships` / `following_memberships` tables, folded
 * into one table with a `kind` discriminator — both sides share the same
 * shape (profile <-> social_user, first/last seen). `removedAt` is what
 * lets the diff engine (spec §149) compute "New"/"Removed" without a
 * separate change log for simple membership churn.
 */
export const memberships = pgTable(
  "memberships",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    socialUserId: uuid("social_user_id")
      .notNull()
      .references(() => socialUsers.id, { onDelete: "cascade" }),
    kind: membershipKindEnum("kind").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileId, table.socialUserId, table.kind] }),
    profileKindIdx: index("memberships_profile_kind_idx").on(table.profileId, table.kind),
  }),
);

/** Future `media_items` table — posts and reels share this shape, spec §31. */
export const mediaItems = pgTable(
  "media_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    mediaType: mediaTypeEnum("media_type").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    caption: text("caption").notNull().default(""),
    likeCount: bigint("like_count", { mode: "number" }).notNull().default(0),
    commentCount: bigint("comment_count", { mode: "number" }).notNull().default(0),
    viewCount: bigint("view_count", { mode: "number" }),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profilePostedAtIdx: index("media_items_profile_posted_at_idx").on(table.profileId, table.postedAt),
  }),
);

/**
 * Future `profile_snapshots` table (spec §149 Data Coverage Model) — one
 * row per indexing pass, from which `CoverageStatus` is computed at read
 * time rather than stored on `profiles` directly (see docs/DATA_MODEL.md).
 */
export const profileSnapshots = pgTable(
  "profile_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    followerCount: bigint("follower_count", { mode: "number" }).notNull(),
    followingCount: bigint("following_count", { mode: "number" }).notNull(),
    postCount: bigint("post_count", { mode: "number" }).notNull(),
    indexedFollowerCount: bigint("indexed_follower_count", { mode: "number" }).notNull(),
    indexedFollowingCount: bigint("indexed_following_count", { mode: "number" }).notNull(),
    followerCoveragePercent: numeric("follower_coverage_percent", { precision: 6, scale: 2 }).notNull(),
    followingCoveragePercent: numeric("following_coverage_percent", { precision: 6, scale: 2 }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileCapturedAtIdx: index("profile_snapshots_profile_captured_at_idx").on(
      table.profileId,
      table.capturedAt,
    ),
  }),
);

/**
 * Future `change_events` table — diff engine output between two
 * `profile_snapshots` (spec §149/§154 "Changes" tab). Membership churn
 * (follower added/removed) is one event kind; profile field changes
 * (bio/display name/avatar) are represented via `field`/`oldValue`/
 * `newValue` instead of a fixed column per field.
 */
/**
 * Spec §21 Tracking/Watchlist, scoped down: the spec's dashboard assumes a
 * logged-in account, which this build doesn't have (see docs/DECISIONS.md).
 * `visitorId` is an anonymous id issued via a first-party cookie the first
 * time someone tracks a profile, standing in for a user id — there's no
 * `users` table for it to reference. No frequency/notification config
 * columns: those need a scheduler and a notification channel, neither of
 * which exist yet.
 */
export const watchlistEntries = pgTable(
  "watchlist_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    visitorId: text("visitor_id").notNull(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    visitorProfileIdx: uniqueIndex("watchlist_entries_visitor_profile_idx").on(table.visitorId, table.profileId),
  }),
);

/**
 * Spec §22 Saved Searches — same anonymous-visitor scoping as
 * watchlistEntries above (no accounts, see docs/TRACKING.md). Storing the
 * raw `query` string (rather than, say, a structured filter) matches
 * spec §22's own example ("Query: alex") and how the follower/following
 * search box already works (src/components/followers/member-list.tsx).
 */
export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    visitorId: text("visitor_id").notNull(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: membershipKindEnum("kind").notNull(),
    query: text("query").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    visitorProfileKindQueryIdx: uniqueIndex("saved_searches_visitor_profile_kind_query_idx").on(
      table.visitorId,
      table.profileId,
      table.kind,
      table.query,
    ),
  }),
);

export const changeEvents = pgTable(
  "change_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    fromSnapshotId: uuid("from_snapshot_id").references(() => profileSnapshots.id, {
      onDelete: "set null",
    }),
    toSnapshotId: uuid("to_snapshot_id")
      .notNull()
      .references(() => profileSnapshots.id, { onDelete: "cascade" }),
    membershipEvent: membershipEventEnum("membership_event"),
    membershipKind: membershipKindEnum("membership_kind"),
    socialUserId: uuid("social_user_id").references(() => socialUsers.id, { onDelete: "cascade" }),
    field: text("field"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileDetectedAtIdx: index("change_events_profile_detected_at_idx").on(
      table.profileId,
      table.detectedAt,
    ),
  }),
);

/**
 * Spec §31 `users` table, trimmed to email + password auth (no OAuth, no
 * magic links in this build — see docs/AUTH.md). An account is optional:
 * tracking and saved searches keep working for anonymous visitors via the
 * cookie scoping in docs/TRACKING.md — an account only upgrades that
 * scope to persist across browsers/devices (see src/lib/auth/identity.ts).
 * `passwordHash` is never the plaintext password; `plan` gates the limits
 * in docs/BILLING.md, which has no real payment processing behind it.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    passwordHash: text("password_hash").notNull(),
    plan: planEnum("plan").notNull().default("free"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    normalizedEmailIdx: uniqueIndex("users_normalized_email_idx").on(table.normalizedEmail),
  }),
);

/**
 * Session tokens are never stored raw — only a SHA-256 hash of the random
 * token that's actually set in the `st_session` cookie (src/lib/auth/session.ts),
 * the same reason a password is hashed rather than stored: a leaked
 * database row shouldn't be enough to impersonate a logged-in session.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
  }),
);
