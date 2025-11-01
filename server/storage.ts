// path: src/server/storage.ts
import { randomUUID } from "crypto";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { db, pool } from "./db";
import * as geoip from "geoip-lite";
import {
  users,
  creatorProfiles,
  companyProfiles,
  offers,
  offerVideos,
  applications,
  conversations,
  messages,
  reviews,
  favorites,
  analytics,
  clickEvents,
  paymentSettings,
  payments,
  retainerPayments,
  retainerContracts,
  retainerApplications,
  retainerDeliverables,
  notifications,
  userNotificationPreferences,
  type User,
  type UpsertUser,
  type InsertUser,
  type CreatorProfile,
  type InsertCreatorProfile,
  type CompanyProfile,
  type InsertCompanyProfile,
  type Offer,
  type InsertOffer,
  type OfferVideo,
  type InsertOfferVideo,
  type Application,
  type InsertApplication,
  type Message,
  type InsertMessage,
  type Review,
  type InsertReview,
  type Favorite,
  type InsertFavorite,
  type Analytics,
  type PaymentSetting,
  type InsertPaymentSetting,
  type Payment,
  type InsertPayment,
  type RetainerPayment,
  type InsertRetainerPayment,
  type RetainerContract,
  type InsertRetainerContract,
  type RetainerApplication,
  type InsertRetainerApplication,
  type RetainerDeliverable,
  type InsertRetainerDeliverable,
  type Notification,
  type InsertNotification,
  type UserNotificationPreferences,
  type InsertUserNotificationPreferences,
} from "@shared/schema";

/**
 * Postgres error codes related to missing schema objects:
 *  - 42P01: undefined_table
 *  - 42704: undefined_object / undefined_object type
 */
const MISSING_SCHEMA_CODES = new Set(["42P01", "42704"]);
const MISSING_COLUMN_CODES = new Set(["42703"]);

const NOTIFICATION_OPTIONAL_COLUMNS = [
  "type",
  "title",
  "user_id",
  "metadata",
  "message",
  "link_url",
  "is_read",
  "read_at",
  "created_at",
];

const REVIEW_OPTIONAL_COLUMNS = [
  "category_ratings",
  "status",
  "edited_by_admin",
  "admin_notes",
  "overall_rating",
  "payment_speed_rating",
  "communication_rating",
  "offer_quality_rating",
  "support_rating",
  "company_response",
  "company_responded_at",
  "is_edited",
  "admin_note",
  "is_approved",
  "approved_by",
  "approved_at",
  "is_hidden",
];

function isMissingRelationError(error: unknown, relation: string): boolean {
  if (!error || typeof error !== "object") return false;

  const { code, message } = error as { code?: string; message?: unknown };

  // If error code hints at missing objects, prefer message inspection when present.
  if (typeof code === "string" && MISSING_SCHEMA_CODES.has(code)) {
    if (typeof message !== "string") return true; // No message to verify, still safe to treat as missing.

    const normalized = message.toLowerCase();
    const target = relation.toLowerCase();

    if (normalized.includes(target)) return true;
  }

  if (typeof message === "string") {
    // Fast exact check with original casing for common path.
    if (message.includes(`relation "${relation}" does not exist`)) return true;

    // Robust checks with normalized forms.
    const normalized = message.toLowerCase();
    const target = relation.toLowerCase();

    if (normalized.includes(`relation "${target}" does not exist`)) return true;
    if (normalized.includes(`table "${target}" does not exist`)) return true;
    if (normalized.includes(`type "${target}" does not exist`)) return true;

    // Regex catch-all; supports relation|table|type and schema-qualified names
    const match = normalized.match(/(?:relation|table|type) "([^"\\]+)" does not exist/);
    if (match) {
      const relationName = match[1];
      if (relationName === target || relationName.endsWith(`.${target}`)) return true;
    }
  }

  return false;
}

function isMissingColumnError(error: unknown, relation: string, columns: string[] = []): boolean {
  if (!error || typeof error !== "object") return false;

  const { code, message } = error as { code?: string; message?: unknown };
  const normalizedRelation = relation.toLowerCase();

  const matchesColumns = (text: string) => {
    if (!columns.length) return true;
    const normalizedText = text.toLowerCase();
    return columns.some((column) => normalizedText.includes(column.toLowerCase()));
  };

  const inspect = (value: unknown) => {
    if (typeof value !== "string") return false;
    const normalized = value.toLowerCase();
    if (!normalized.includes("column")) return false;

    // Messages commonly look like:
    //   column "overall_rating" does not exist
    //   column "overall_rating" of relation "reviews" does not exist
    //   column "public.notifications.metadata" does not exist
    const mentionsRelation = normalized.includes(normalizedRelation);
    const mentionsMissingColumn =
      normalized.includes("does not exist") && matchesColumns(normalized);

    if (mentionsRelation && matchesColumns(normalized)) return true;
    if (mentionsMissingColumn) return true;

    return false;
  };

  if (typeof code === "string" && MISSING_COLUMN_CODES.has(code)) {
    if (inspect(message)) return true;
    if (typeof message !== "string") return true;
  }

  if (inspect(message)) return true;

  return false;
}

function coerceCount(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function buildEphemeralNotification(notification: InsertNotification): Notification {
  const now = new Date();
  const partial = notification as Partial<Notification>;

  const isRead = partial.isRead ?? false;
  const readAt = isRead ? partial.readAt ?? now : null;

  return {
    id: randomUUID(),
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    linkUrl: notification.linkUrl ?? null,
    metadata: notification.metadata ?? null,
    isRead,
    readAt,
    createdAt: now,
  };
}

function buildEphemeralReview(review: InsertReview): Review {
  const now = new Date();
  const partial = review as Partial<Review>;

  return {
    id: randomUUID(),
    applicationId: review.applicationId,
    creatorId: review.creatorId,
    companyId: review.companyId,
    reviewText: partial.reviewText ?? null,
    overallRating: review.overallRating,
    paymentSpeedRating: partial.paymentSpeedRating ?? null,
    communicationRating: partial.communicationRating ?? null,
    offerQualityRating: partial.offerQualityRating ?? null,
    supportRating: partial.supportRating ?? null,
    companyResponse: partial.companyResponse ?? null,
    companyRespondedAt: partial.companyRespondedAt ?? null,
    isEdited: partial.isEdited ?? false,
    adminNote: partial.adminNote ?? null,
    isApproved: partial.isApproved ?? true,
    approvedBy: partial.approvedBy ?? null,
    approvedAt: partial.approvedAt ?? null,
    isHidden: partial.isHidden ?? false,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

function buildDefaultNotificationPreferences(userId: string): UserNotificationPreferences {
  const now = new Date();

  return {
    id: randomUUID(),
    userId,
    emailNotifications: true,
    pushNotifications: true,
    inAppNotifications: true,
    emailApplicationStatus: true,
    emailNewMessage: true,
    emailPayment: true,
    emailOffer: true,
    emailReview: true,
    emailSystem: true,
    pushApplicationStatus: true,
    pushNewMessage: true,
    pushPayment: true,
    pushSubscription: null,
    createdAt: now,
    updatedAt: now,
  };
}

function isMissingNotificationSchema(error: unknown): boolean {
  // Some Postgres setups emit missing enum/type for notification_type as well.
  return (
    isMissingRelationError(error, "notifications") ||
    isMissingRelationError(error, "notification_type")
  );
}

function isLegacyNotificationColumnError(error: unknown): boolean {
  return isMissingColumnError(error, "notifications", NOTIFICATION_OPTIONAL_COLUMNS);
}

function isLegacyReviewColumnError(error: unknown): boolean {
  return isMissingColumnError(error, "reviews", REVIEW_OPTIONAL_COLUMNS);
}

function safeParseJson<T = unknown>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

function coerceDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const result = new Date(value);
    if (!Number.isNaN(result.getTime())) {
      return result;
    }
  }
  return new Date();
}

function coerceBoolean(value: unknown, fallback: boolean = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "t", "1", "yes"].includes(normalized)) return true;
    if (["false", "f", "0", "no"].includes(normalized)) return false;
  }
  return fallback;
}

function coerceNumberValue(value: unknown, fallback: number = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (typeof value === "bigint") return Number(value);
  return fallback;
}

function coerceOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

async function getExistingColumns(table: string): Promise<Set<string>> {
  try {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    return new Set(result.rows.map((row: any) => row.column_name as string));
  } catch (error) {
    console.warn(`[Storage] Unable to inspect columns for ${table}:`, error);
    return new Set();
  }
}

function mapLegacyNotificationRow(
  row: any,
  columns: Set<string>,
  fallbackUserId: string,
): Notification {
  const metadataValue = columns.has("metadata") ? row.metadata ?? null : null;
  const messageCandidate =
    (columns.has("message") ? row.message : undefined) ??
    row.content ??
    row.body ??
    row.description ??
    "";
  const normalizedMessage =
    typeof messageCandidate === "string"
      ? messageCandidate
      : messageCandidate
        ? JSON.stringify(messageCandidate)
        : "";

  const titleCandidate =
    (columns.has("title") ? row.title : undefined) ??
    row.subject ??
    (normalizedMessage ? normalizedMessage.slice(0, 120) : null);

  return {
    id: row.id ?? randomUUID(),
    userId: row.user_id ?? fallbackUserId,
    type: row.type ?? "system_announcement",
    title: titleCandidate || "Notification",
    message: normalizedMessage || titleCandidate || "Notification update",
    linkUrl: columns.has("link_url") ? row.link_url ?? null : null,
    metadata: safeParseJson(metadataValue),
    isRead: columns.has("is_read") ? coerceBoolean(row.is_read, false) : false,
    readAt: columns.has("read_at") && row.read_at ? coerceDate(row.read_at) : null,
    createdAt: columns.has("created_at") && row.created_at ? coerceDate(row.created_at) : new Date(),
  };
}

async function legacyFetchNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean; columns?: Set<string> } = {},
): Promise<Notification[]> {
  const columns = options.columns ?? (await getExistingColumns("notifications"));
  if (!columns.size) return [];

  const where: string[] = ["user_id = $1"];
  const params: any[] = [userId];
  let paramIndex = 2;

  if (options.unreadOnly && columns.has("is_read")) {
    where.push("(is_read = false OR is_read IS NULL)");
  }

  const orderColumn = columns.has("created_at") ? "created_at" : "id";
  let limitClause = "";
  if (typeof options.limit === "number") {
    limitClause = ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  const query = `SELECT * FROM notifications WHERE ${where.join(" AND ")} ORDER BY ${orderColumn} DESC${limitClause}`;

  try {
    const result = await pool.query(query, params);
    return result.rows.map((row: any) => mapLegacyNotificationRow(row, columns, userId));
  } catch (error) {
    console.warn("[Storage] Legacy notifications query failed:", error);
    return [];
  }
}

async function legacyFetchUnreadNotifications(userId: string): Promise<Notification[]> {
  const columns = await getExistingColumns("notifications");
  if (!columns.size) return [];

  if (!columns.has("is_read")) {
    // Without an is_read column, treat all notifications as unread.
    return legacyFetchNotifications(userId, { columns });
  }

  return legacyFetchNotifications(userId, { columns, unreadOnly: true });
}

async function legacyCountUnreadNotifications(userId: string): Promise<number> {
  const columns = await getExistingColumns("notifications");
  if (!columns.size) return 0;

  const baseQuery = columns.has("is_read")
    ? `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND (is_read = false OR is_read IS NULL)`
    : `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1`;

  try {
    const result = await pool.query(baseQuery, [userId]);
    return coerceCount(result.rows[0]?.count ?? 0);
  } catch (error) {
    console.warn("[Storage] Legacy unread notification count failed:", error);
    return 0;
  }
}

function mapLegacyReviewRow(row: any, columns: Set<string>): Review {
  const createdAt = columns.has("created_at") && row.created_at ? coerceDate(row.created_at) : new Date();
  const updatedAt = columns.has("updated_at") && row.updated_at ? coerceDate(row.updated_at) : createdAt;

  const categoryRatings = columns.has("category_ratings")
    ? safeParseJson<Record<string, unknown>>(row.category_ratings) ?? {}
    : {};

  const readCategoryRating = (...keys: string[]): number | null => {
    for (const key of keys) {
      if (categoryRatings && typeof categoryRatings === "object" && key in categoryRatings) {
        const value = (categoryRatings as Record<string, unknown>)[key];
        const coerced = coerceOptionalNumber(value);
        if (coerced !== null) return coerced;
      }
    }
    return null;
  };

  const statusValue = columns.has("status") && typeof row.status === "string" ? row.status.toLowerCase() : null;
  const isPending = statusValue ? ["pending", "under_review", "flagged"].includes(statusValue) : false;
  const isHiddenByStatus = statusValue ? ["hidden", "flagged", "removed"].includes(statusValue) : false;

  return {
    id: row.id ?? randomUUID(),
    applicationId: row.application_id ?? row.applicationId ?? "",
    creatorId: row.creator_id ?? row.creatorId ?? "",
    companyId: row.company_id ?? row.companyId ?? "",
    reviewText: row.review_text ?? row.review ?? row.text ?? null,
    overallRating:
      coerceNumberValue(
        row.overall_rating ??
          row.rating ??
          readCategoryRating("overall", "overallRating", "rating") ??
          0,
      ) || 0,
    paymentSpeedRating:
      coerceOptionalNumber(row.payment_speed_rating ?? row.payment_speed) ??
      readCategoryRating("payment_speed", "paymentSpeed"),
    communicationRating:
      coerceOptionalNumber(row.communication_rating ?? row.communication) ??
      readCategoryRating("communication", "communication_rating"),
    offerQualityRating:
      coerceOptionalNumber(row.offer_quality_rating ?? row.offer_quality) ??
      readCategoryRating("offer_quality", "offerQuality"),
    supportRating:
      coerceOptionalNumber(row.support_rating) ?? readCategoryRating("support", "support_rating"),
    companyResponse: columns.has("company_response") ? row.company_response ?? null : null,
    companyRespondedAt:
      columns.has("company_responded_at") && row.company_responded_at
        ? coerceDate(row.company_responded_at)
        : null,
    isEdited:
      columns.has("is_edited")
        ? coerceBoolean(row.is_edited, false)
        : columns.has("edited_by_admin")
          ? coerceBoolean(row.edited_by_admin, false)
          : false,
    adminNote:
      columns.has("admin_note")
        ? row.admin_note ?? null
        : columns.has("admin_notes")
          ? row.admin_notes ?? null
          : null,
    isApproved:
      columns.has("is_approved")
        ? coerceBoolean(row.is_approved, true)
        : statusValue
          ? !isPending && statusValue !== "rejected"
          : true,
    approvedBy: columns.has("approved_by") ? row.approved_by ?? null : null,
    approvedAt: columns.has("approved_at") && row.approved_at ? coerceDate(row.approved_at) : null,
    isHidden:
      columns.has("is_hidden")
        ? coerceBoolean(row.is_hidden, false)
        : isHiddenByStatus,
    createdAt,
    updatedAt,
  };
}

async function legacyFetchReviews(): Promise<Review[]> {
  const columns = await getExistingColumns("reviews");
  if (!columns.size) return [];

  const orderColumn = columns.has("created_at") ? "created_at" : "id";

  try {
    const result = await pool.query(`SELECT * FROM reviews ORDER BY ${orderColumn} DESC`);
    return result.rows.map((row: any) => mapLegacyReviewRow(row, columns));
  } catch (error) {
    console.warn("[Storage] Legacy reviews query failed:", error);
    return [];
  }
}

export interface AdminCreatorSummary {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  accountStatus: User["accountStatus"];
  createdAt: Date | null;
  profile:
    | {
        bio: string | null;
        youtubeFollowers: number | null;
        tiktokFollowers: number | null;
        instagramFollowers: number | null;
      }
    | null;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;

  // Creator Profiles
  getCreatorProfile(userId: string): Promise<CreatorProfile | undefined>;
  createCreatorProfile(profile: InsertCreatorProfile): Promise<CreatorProfile>;
  updateCreatorProfile(userId: string, updates: Partial<InsertCreatorProfile>): Promise<CreatorProfile | undefined>;

  // Company Profiles
  getCompanyProfile(userId: string): Promise<CompanyProfile | undefined>;
  getCompanyProfileById(id: string): Promise<CompanyProfile | undefined>;
  createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile>;
  updateCompanyProfile(userId: string, updates: Partial<InsertCompanyProfile>): Promise<CompanyProfile | undefined>;
  getPendingCompanies(): Promise<CompanyProfile[]>;
  approveCompany(companyId: string): Promise<CompanyProfile | undefined>;
  rejectCompany(companyId: string, reason: string): Promise<CompanyProfile | undefined>;

  // Offers
  getOffer(id: string): Promise<Offer | undefined>;
  getOffers(filters?: any): Promise<Offer[]>;
  getOffersByCompany(companyId: string): Promise<Offer[]>;
  createOffer(offer: InsertOffer): Promise<Offer>;
  updateOffer(id: string, updates: Partial<InsertOffer>): Promise<Offer | undefined>;
  deleteOffer(id: string): Promise<void>;
  getPendingOffers(): Promise<Offer[]>;
  approveOffer(offerId: string): Promise<Offer | undefined>;

  // Offer Videos
  getOfferVideos(offerId: string): Promise<OfferVideo[]>;
  createOfferVideo(video: InsertOfferVideo): Promise<OfferVideo>;
  deleteOfferVideo(id: string): Promise<void>;

  // Applications
  getApplication(id: string): Promise<Application | undefined>;
  getApplicationByTrackingCode(trackingCode: string): Promise<Application | undefined>;
  getApplicationsByCreator(creatorId: string): Promise<Application[]>;
  getApplicationsByOffer(offerId: string): Promise<Application[]>;
  getAllPendingApplications(): Promise<Application[]>;
  createApplication(application: InsertApplication): Promise<Application>;
  updateApplication(id: string, updates: Partial<InsertApplication>): Promise<Application | undefined>;
  approveApplication(id: string, trackingLink: string, trackingCode: string): Promise<Application | undefined>;
  completeApplication(id: string): Promise<Application | undefined>;
  getApplicationsByCompany(companyId: string): Promise<any[]>;

  // Messages & Conversations
  getConversation(id: string): Promise<any>;
  getConversationsByUser(
    userId: string,
    userRole: string,
    companyProfileId?: string | null,
  ): Promise<any[]>;
  createConversation(data: any): Promise<any>;
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(conversationId: string): Promise<Message[]>;
  markMessagesAsRead(conversationId: string, userId: string): Promise<void>;

  // Reviews
  getReviewsByCompany(companyId: string): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: string, updates: Partial<InsertReview>): Promise<Review | undefined>;

  // Favorites
  getFavoritesByCreator(creatorId: string): Promise<Favorite[]>;
  isFavorite(creatorId: string, offerId: string): Promise<boolean>;
  createFavorite(favorite: InsertFavorite): Promise<Favorite>;
  deleteFavorite(creatorId: string, offerId: string): Promise<void>;

  // Analytics
  getAnalyticsByCreator(creatorId: string): Promise<any>;
  getAnalyticsTimeSeriesByCreator(creatorId: string, dateRange: string): Promise<any[]>;
  getAnalyticsByApplication(applicationId: string): Promise<any[]>;
  logTrackingClick(
    applicationId: string,
    clickData: { ip: string; userAgent: string; referer: string; timestamp: Date },
  ): Promise<void>;
  recordConversion(applicationId: string, saleAmount?: number): Promise<void>;

  // Payment Settings
  getPaymentSettings(userId: string): Promise<PaymentSetting[]>;
  createPaymentSetting(setting: InsertPaymentSetting): Promise<PaymentSetting>;
  deletePaymentSetting(id: string): Promise<void>;

  // Payments
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByCreator(creatorId: string): Promise<Payment[]>;
  getPaymentsByCompany(companyId: string): Promise<Payment[]>;
  getAllPayments(): Promise<any[]>;
  updatePaymentStatus(id: string, status: string, updates?: Partial<InsertPayment>): Promise<Payment | undefined>;

  // Retainer Contracts
  getRetainerContract(id: string): Promise<any>;
  getRetainerContracts(filters?: any): Promise<any[]>;
  getRetainerContractsByCompany(companyId: string): Promise<any[]>;
  getRetainerContractsByCreator(creatorId: string): Promise<any[]>;
  getOpenRetainerContracts(): Promise<any[]>;
  createRetainerContract(contract: any): Promise<any>;
  updateRetainerContract(id: string, updates: any): Promise<any>;
  deleteRetainerContract(id: string): Promise<void>;

  // Retainer Applications
  getRetainerApplication(id: string): Promise<any>;
  getRetainerApplicationsByContract(contractId: string): Promise<any[]>;
  getRetainerApplicationsByCreator(creatorId: string): Promise<any[]>;
  createRetainerApplication(application: any): Promise<any>;
  updateRetainerApplication(id: string, updates: any): Promise<any>;
  approveRetainerApplication(id: string, contractId: string, creatorId: string): Promise<any>;
  rejectRetainerApplication(id: string): Promise<any>;

  // Retainer Deliverables
  getRetainerDeliverable(id: string): Promise<any>;
  getRetainerDeliverablesByContract(contractId: string): Promise<any[]>;
  getRetainerDeliverablesByCreator(creatorId: string): Promise<any[]>;
  getRetainerDeliverablesForMonth(contractId: string, monthNumber: number): Promise<any[]>;
  createRetainerDeliverable(deliverable: any): Promise<any>;
  updateRetainerDeliverable(id: string, updates: any): Promise<any>;
  approveRetainerDeliverable(id: string, reviewNotes?: string): Promise<any>;
  rejectRetainerDeliverable(id: string, reviewNotes: string): Promise<any>;
  requestRevision(id: string, reviewNotes: string): Promise<any>;
  createRetainerPayment(payment: InsertRetainerPayment): Promise<RetainerPayment>;

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  clearAllNotifications(userId: string): Promise<void>;

  // User Notification Preferences
  getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | null>;
  createUserNotificationPreferences(
    preferences: InsertUserNotificationPreferences,
  ): Promise<UserNotificationPreferences>;
  updateUserNotificationPreferences(
    userId: string,
    updates: Partial<InsertUserNotificationPreferences>,
  ): Promise<UserNotificationPreferences | undefined>;

  // Admin
  getCreatorsForAdmin(): Promise<AdminCreatorSummary[]>;
  suspendCreator(userId: string): Promise<User | undefined>;
  unsuspendCreator(userId: string): Promise<User | undefined>;
  banCreator(userId: string): Promise<User | undefined>;

  // Helper methods
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values({
        ...user,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  // Creator Profiles
  async getCreatorProfile(userId: string): Promise<CreatorProfile | undefined> {
    const result = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, userId))
      .limit(1);
    return result[0];
  }

  async createCreatorProfile(profile: InsertCreatorProfile): Promise<CreatorProfile> {
    const result = await db
      .insert(creatorProfiles)
      .values({
        ...profile,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateCreatorProfile(
    userId: string,
    updates: Partial<InsertCreatorProfile>,
  ): Promise<CreatorProfile | undefined> {
    const result = await db
      .update(creatorProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(creatorProfiles.userId, userId))
      .returning();
    return result[0];
  }

  // Company Profiles
  async getCompanyProfile(userId: string): Promise<CompanyProfile | undefined> {
    const result = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.userId, userId))
      .limit(1);
    return result[0];
  }

  async getCompanyProfileById(id: string): Promise<CompanyProfile | undefined> {
    const result = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.id, id))
      .limit(1);
    return result[0];
  }

  async createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile> {
    const result = await db
      .insert(companyProfiles)
      .values({
        ...profile,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateCompanyProfile(
    userId: string,
    updates: Partial<InsertCompanyProfile>,
  ): Promise<CompanyProfile | undefined> {
    const result = await db
      .update(companyProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(companyProfiles.userId, userId))
      .returning();
    return result[0];
  }

  async getPendingCompanies(): Promise<CompanyProfile[]> {
    return await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.status, "pending"))
      .orderBy(desc(companyProfiles.createdAt));
  }

  async approveCompany(companyId: string): Promise<CompanyProfile | undefined> {
    const result = await db
      .update(companyProfiles)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(companyProfiles.id, companyId))
      .returning();
    return result[0];
  }

  async rejectCompany(companyId: string, reason: string): Promise<CompanyProfile | undefined> {
    const result = await db
      .update(companyProfiles)
      .set({ status: "rejected", rejectionReason: reason, updatedAt: new Date() })
      .where(eq(companyProfiles.id, companyId))
      .returning();
    return result[0];
  }

  // Offers
  async getOffer(id: string): Promise<Offer | undefined> {
    const result = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
    return result[0];
  }

  async getOffers(_filters?: any): Promise<Offer[]> {
    return await db
      .select()
      .from(offers)
      .where(eq(offers.status, "approved"))
      .orderBy(desc(offers.createdAt))
      .limit(100);
  }

  async getOffersByCompany(companyId: string): Promise<Offer[]> {
    return await db
      .select()
      .from(offers)
      .where(eq(offers.companyId, companyId))
      .orderBy(desc(offers.createdAt));
  }

  async createOffer(offer: InsertOffer): Promise<Offer> {
    const offerId = randomUUID();

    const slug = offer.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    const commission_details: any = {
      type: offer.commissionType,
    };

    if (offer.commissionType === "per_sale" && offer.commissionPercentage) {
      commission_details.percentage = offer.commissionPercentage;
    }

    if (offer.commissionType !== "per_sale" && offer.commissionAmount) {
      commission_details.amount = offer.commissionAmount;
    }

    // ✅ FIX: Added featuredImageUrl to the VALUES list
    const result = await db.execute(sql`
      INSERT INTO offers (
        id, company_id, title, slug, short_description, full_description,
        product_name, primary_niche, product_url, commission_type,
        commission_details, commission_percentage, commission_amount,
        status, created_at, updated_at, niches, requirements, featured_image_url,
        is_priority, view_count, application_count, active_creator_count
      ) VALUES (
        ${offerId},
        ${offer.companyId}::uuid,
        ${offer.title},
        ${slug},
        ${offer.shortDescription},
        ${offer.fullDescription},
        ${offer.productName},
        ${offer.primaryNiche},
        ${offer.productUrl},
        ${offer.commissionType},
        ${JSON.stringify(commission_details)}::jsonb,
        ${offer.commissionPercentage || null},
        ${offer.commissionAmount || null},
        ${offer.status || "pending_review"},
        NOW(),
        NOW(),
        ARRAY[]::varchar[],
        '{}'::jsonb,
        ${offer.featuredImageUrl || null},
        false,
        0,
        0,
        0
      )
      RETURNING *
    `);

    return result.rows[0] as Offer;
  }

  async updateOffer(id: string, updates: Partial<InsertOffer>): Promise<Offer | undefined> {
    const result = await db
      .update(offers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(offers.id, id))
      .returning();
    return result[0];
  }

  async deleteOffer(id: string): Promise<void> {
    await db.delete(offers).where(eq(offers.id, id));
  }

  async getPendingOffers(): Promise<Offer[]> {
    return await db
      .select()
      .from(offers)
      .where(eq(offers.status, "pending_review"))
      .orderBy(desc(offers.createdAt));
  }

  async approveOffer(offerId: string): Promise<Offer | undefined> {
    const result = await db
      .update(offers)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(offers.id, offerId))
      .returning();
    return result[0];
  }

  // Offer Videos
  async getOfferVideos(offerId: string): Promise<OfferVideo[]> {
    return await db
      .select()
      .from(offerVideos)
      .where(eq(offerVideos.offerId, offerId))
      .orderBy(offerVideos.orderIndex);
  }

  async createOfferVideo(video: InsertOfferVideo): Promise<OfferVideo> {
    const result = await db
      .insert(offerVideos)
      .values({
        ...video,
        id: randomUUID(),
        createdAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async deleteOfferVideo(id: string): Promise<void> {
    await db.delete(offerVideos).where(eq(offerVideos.id, id));
  }

  // Applications
  async getApplication(id: string): Promise<Application | undefined> {
    const result = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    return result[0];
  }

  async getApplicationByTrackingCode(trackingCode: string): Promise<Application | undefined> {
    const result = await db
      .select()
      .from(applications)
      .where(eq(applications.trackingCode, trackingCode))
      .limit(1);
    return result[0];
  }

  async getApplicationsByCreator(creatorId: string): Promise<Application[]> {
    try {
      const result = await db
        .select()
        .from(applications)
        .where(eq(applications.creatorId, creatorId))
        .orderBy(desc(applications.createdAt));
      return result || [];
    } catch (error) {
      console.error("[getApplicationsByCreator] Error:", error);
      return [];
    }
  }

  async getApplicationsByOffer(offerId: string): Promise<Application[]> {
    return await db
      .select()
      .from(applications)
      .where(eq(applications.offerId, offerId))
      .orderBy(desc(applications.createdAt));
  }

  async getAllPendingApplications(): Promise<Application[]> {
    return await db
      .select()
      .from(applications)
      .where(eq(applications.status, "pending"))
      .orderBy(applications.autoApprovalScheduledAt);
  }

  async createApplication(application: InsertApplication): Promise<Application> {
    const autoApprovalTime = new Date();
    autoApprovalTime.setMinutes(autoApprovalTime.getMinutes() + 7); // why: business rule

    const result = await db
      .insert(applications)
      .values({
        ...application,
        id: randomUUID(),
        autoApprovalScheduledAt: autoApprovalTime,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateApplication(id: string, updates: Partial<InsertApplication>): Promise<Application | undefined> {
    const result = await db
      .update(applications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();
    return result[0];
  }

  async approveApplication(
    id: string,
    trackingLink: string,
    trackingCode: string,
  ): Promise<Application | undefined> {
    const result = await db
      .update(applications)
      .set({
        status: "approved",
        trackingLink,
        trackingCode,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(applications.id, id))
      .returning();
    return result[0];
  }

  async completeApplication(id: string): Promise<Application | undefined> {
    const result = await db
      .update(applications)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(applications.id, id))
      .returning();
    return result[0];
  }

  async getApplicationsByCompany(companyId: string): Promise<any[]> {
    const result = await db
      .select({
        id: applications.id,
        offerId: applications.offerId,
        offerTitle: offers.title,
        creatorId: applications.creatorId,
        creatorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
        creatorEmail: users.email,
        message: applications.message,
        status: applications.status,
        trackingLink: applications.trackingLink,
        trackingCode: applications.trackingCode,
        approvedAt: applications.approvedAt,
        completedAt: applications.completedAt,
        createdAt: applications.createdAt,
        updatedAt: applications.updatedAt,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
        creatorProfileImageUrl: users.profileImageUrl,
        creatorBio: creatorProfiles.bio,
        creatorYoutubeUrl: creatorProfiles.youtubeUrl,
        creatorTiktokUrl: creatorProfiles.tiktokUrl,
        creatorInstagramUrl: creatorProfiles.instagramUrl,
        creatorNiches: creatorProfiles.niches,
        clickCount: sql<number>`COALESCE(SUM(${analytics.clicks}), 0)`,
        uniqueClickCount: sql<number>`COALESCE(SUM(${analytics.uniqueClicks}), 0)`,
        conversionCount: sql<number>`COALESCE(SUM(${analytics.conversions}), 0)`,
        totalEarnings: sql<string>`COALESCE(SUM(${analytics.earnings}), 0)`,
      })
      .from(applications)
      .innerJoin(offers, eq(applications.offerId, offers.id))
      .innerJoin(users, eq(applications.creatorId, users.id))
      .leftJoin(creatorProfiles, eq(users.id, creatorProfiles.userId))
      .leftJoin(analytics, eq(applications.id, analytics.applicationId))
      .where(eq(offers.companyId, companyId))
      .groupBy(applications.id, offers.id, users.id, creatorProfiles.id)
      .orderBy(desc(applications.createdAt));

    return result.map((app) => ({
      id: app.id,
      offerId: app.offerId,
      offerTitle: app.offerTitle,
      creatorId: app.creatorId,
      creatorName: app.creatorName,
      creatorEmail: app.creatorEmail,
      message: app.message,
      status: app.status,
      trackingLink: app.trackingLink,
      trackingCode: app.trackingCode,
      approvedAt: app.approvedAt,
      completedAt: app.completedAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      clickCount: app.clickCount,
      conversionCount: app.conversionCount,
      totalEarnings: app.totalEarnings,
      creator: {
        id: app.creatorId,
        firstName: app.creatorFirstName,
        lastName: app.creatorLastName,
        email: app.creatorEmail,
        profileImageUrl: app.creatorProfileImageUrl,
        bio: app.creatorBio,
        youtubeUrl: app.creatorYoutubeUrl,
        tiktokUrl: app.creatorTiktokUrl,
        instagramUrl: app.creatorInstagramUrl,
        niches: app.creatorNiches,
      },
    }));
  }

  // Messages & Conversations
  async getConversation(id: string): Promise<any> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return result[0];
  }

  async getConversationsByUser(
    userId: string,
    userRole: string,
    companyProfileId: string | null = null,
  ): Promise<any[]> {
    const whereClause =
      userRole === "company" && companyProfileId
        ? eq(conversations.companyId, companyProfileId)
        : eq(conversations.creatorId, userId);

    const result = await db
      .select({
        id: conversations.id,
        applicationId: conversations.applicationId,
        creatorId: conversations.creatorId,
        companyId: conversations.companyId,
        offerId: conversations.offerId,
        lastMessageAt: conversations.lastMessageAt,
        creatorUnreadCount: conversations.creatorUnreadCount,
        companyUnreadCount: conversations.companyUnreadCount,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        offerTitle: offers.title,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
        creatorEmail: users.email,
        creatorProfileImageUrl: users.profileImageUrl,
        companyLegalName: companyProfiles.legalName,
        companyTradeName: companyProfiles.tradeName,
        companyLogoUrl: companyProfiles.logoUrl,
        companyUserId: companyProfiles.userId,
      })
      .from(conversations)
      .innerJoin(offers, eq(conversations.offerId, offers.id))
      .innerJoin(users, eq(conversations.creatorId, users.id))
      .innerJoin(companyProfiles, eq(conversations.companyId, companyProfiles.id))
      .where(whereClause)
      .orderBy(desc(conversations.lastMessageAt));

    return result.map((conv) => ({
      id: conv.id,
      applicationId: conv.applicationId,
      creatorId: conv.creatorId,
      companyId: conv.companyId,
      offerId: conv.offerId,
      offerTitle: conv.offerTitle,
      lastMessageAt: conv.lastMessageAt,
      creatorUnreadCount: conv.creatorUnreadCount,
      companyUnreadCount: conv.companyUnreadCount,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      otherUser:
        userRole === "company"
          ? {
              id: conv.creatorId,
              name: `${conv.creatorFirstName || ""} ${conv.creatorLastName || ""}`.trim() ||
                conv.creatorEmail,
              firstName: conv.creatorFirstName,
              lastName: conv.creatorLastName,
              email: conv.creatorEmail,
              profileImageUrl: conv.creatorProfileImageUrl,
            }
          : {
              id: conv.companyUserId,
              name: conv.companyTradeName || conv.companyLegalName,
              legalName: conv.companyLegalName,
              tradeName: conv.companyTradeName,
              logoUrl: conv.companyLogoUrl,
            },
    }));
  }

  async createConversation(data: any): Promise<any> {
    const result = await db
      .insert(conversations)
      .values({
        ...data,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    try {
      const result = await db.insert(messages).values(message).returning();

      await db
        .update(conversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, message.conversationId));

      return result[0];
    } catch (error) {
      console.error("[createMessage] Error:", error);
      throw error;
    }
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const result = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt);
      return result || [];
    } catch (error) {
      console.error("[getMessages] Error:", error);
      return [];
    }
  }

  async markMessagesAsRead(conversationId: string, _userId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.conversationId, conversationId), eq(messages.isRead, false)));
  }

  // Reviews
  async getReviewsByCompany(companyId: string): Promise<Review[]> {
    try {
      return await db
        .select()
        .from(reviews)
        .where(eq(reviews.companyId, companyId))
        .orderBy(desc(reviews.createdAt));
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while fetching company reviews - attempting legacy fallback.",
        );
        const all = await legacyFetchReviews();
        return all.filter((review) => review.companyId === companyId);
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while fetching company reviews - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async getReviewsByCreator(creatorId: string): Promise<Review[]> {
    try {
      return await db
        .select()
        .from(reviews)
        .where(eq(reviews.creatorId, creatorId))
        .orderBy(desc(reviews.createdAt));
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while fetching creator reviews - attempting legacy fallback.",
        );
        const all = await legacyFetchReviews();
        return all.filter((review) => review.creatorId === creatorId);
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while fetching creator reviews - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async createReview(review: InsertReview): Promise<Review> {
    try {
      const result = await db
        .insert(reviews)
        .values({
          ...review,
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while creating review - returning ephemeral review.",
        );
        return buildEphemeralReview(review);
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while creating review - returning ephemeral review.",
        );
        return buildEphemeralReview(review);
      }
      throw error;
    }
  }

  async updateReview(id: string, updates: Partial<InsertReview>): Promise<Review | undefined> {
    try {
      const result = await db
        .update(reviews)
        .set({ ...updates, isEdited: true, updatedAt: new Date() })
        .where(eq(reviews.id, id))
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while updating review - treating as no-op.",
        );
        return undefined;
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn("[Storage] reviews relation missing while updating review - treating as no-op.");
        return undefined;
      }
      throw error;
    }
  }

  async getAllReviews(): Promise<Review[]> {
    try {
      return await db.select().from(reviews).orderBy(desc(reviews.createdAt));
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while fetching all reviews - attempting legacy fallback.",
        );
        return legacyFetchReviews();
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while fetching all reviews - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async hideReview(id: string): Promise<Review | undefined> {
    try {
      const result = await db
        .update(reviews)
        .set({ isHidden: true, updatedAt: new Date() })
        .where(eq(reviews.id, id))
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn("[Storage] reviews column mismatch while hiding review - treating as no-op.");
        return undefined;
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn("[Storage] reviews relation missing while hiding review - treating as no-op.");
        return undefined;
      }
      throw error;
    }
  }

  async deleteReview(id: string): Promise<void> {
    try {
      await db.delete(reviews).where(eq(reviews.id, id));
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn("[Storage] reviews column mismatch while deleting review - skipping operation.");
        return;
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn("[Storage] reviews relation missing while deleting review - skipping operation.");
        return;
      }
      throw error;
    }
  }

  async updateAdminNote(id: string, note: string, _adminId: string): Promise<Review | undefined> {
    try {
      const result = await db
        .update(reviews)
        .set({
          adminNote: note,
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, id))
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while updating admin note - treating as no-op.",
        );
        return undefined;
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while updating admin note - treating as no-op.",
        );
        return undefined;
      }
      throw error;
    }
  }

  async approveReview(id: string, adminId: string): Promise<Review | undefined> {
    try {
      const result = await db
        .update(reviews)
        .set({
          isApproved: true,
          isHidden: false,
          approvedBy: adminId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, id))
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyReviewColumnError(error)) {
        console.warn(
          "[Storage] reviews column mismatch while approving review - treating as no-op.",
        );
        return undefined;
      }
      if (isMissingRelationError(error, "reviews")) {
        console.warn(
          "[Storage] reviews relation missing while approving review - treating as no-op.",
        );
        return undefined;
      }
      throw error;
    }
  }

  // Favorites
  async getFavoritesByCreator(creatorId: string): Promise<Favorite[]> {
    try {
      const result = await db.select().from(favorites).where(eq(favorites.creatorId, creatorId));
      return result || [];
    } catch (error) {
      console.error("[getFavoritesByCreator] Error:", error);
      return [];
    }
  }

  async isFavorite(creatorId: string, offerId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.creatorId, creatorId), eq(favorites.offerId, offerId)))
      .limit(1);
    return result.length > 0;
  }

  async createFavorite(favorite: InsertFavorite): Promise<Favorite> {
    const result = await db
      .insert(favorites)
      .values({
        ...favorite,
        id: randomUUID(),
        createdAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async deleteFavorite(creatorId: string, offerId: string): Promise<void> {
    await db
      .delete(favorites)
      .where(and(eq(favorites.creatorId, creatorId), eq(favorites.offerId, offerId)));
  }

  // Analytics
  async getAnalyticsByCreator(creatorId: string): Promise<any> {
    try {
      const result = await db
        .select({
          totalEarnings: sql<number>`COALESCE(SUM(${analytics.earnings}), 0)`,
          totalClicks: sql<number>`COALESCE(SUM(${analytics.clicks}), 0)`,
          uniqueClicks: sql<number>`COALESCE(SUM(${analytics.uniqueClicks}), 0)`,
          conversions: sql<number>`COALESCE(SUM(${analytics.conversions}), 0)`,
        })
        .from(analytics)
        .innerJoin(applications, eq(analytics.applicationId, applications.id))
        .where(eq(applications.creatorId, creatorId));

      return (
        result[0] || {
          totalEarnings: 0,
          totalClicks: 0,
          uniqueClicks: 0,
          conversions: 0,
        }
      );
    } catch (error) {
      console.error("[getAnalyticsByCreator] Error:", error);
      return {
        totalEarnings: 0,
        totalClicks: 0,
        uniqueClicks: 0,
        conversions: 0,
      };
    }
  }

  async getAnalyticsTimeSeriesByCreator(creatorId: string, dateRange: string): Promise<any[]> {
    try {
      const whereClauses: any[] = [eq(applications.creatorId, creatorId)];

      if (dateRange !== "all") {
        let daysBack = 30;
        if (dateRange === "7d") daysBack = 7;
        else if (dateRange === "30d") daysBack = 30;
        else if (dateRange === "90d") daysBack = 90;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        whereClauses.push(sql`${analytics.date} >= ${startDate}`);
      }

      const result = await db
        .select({
          date: sql<string>`TO_CHAR(${analytics.date}, 'Mon DD')`,
          clicks: sql<number>`COALESCE(SUM(${analytics.clicks}), 0)`,
        })
        .from(analytics)
        .innerJoin(applications, eq(analytics.applicationId, applications.id))
        .where(and(...whereClauses))
        .groupBy(analytics.date)
        .orderBy(analytics.date);

      return result || [];
    } catch (error) {
      console.error("[getAnalyticsTimeSeriesByCreator] Error:", error);
      return [];
    }
  }

  async getAnalyticsByApplication(applicationId: string): Promise<any[]> {
    return await db
      .select()
      .from(analytics)
      .where(eq(analytics.applicationId, applicationId))
      .orderBy(desc(analytics.date));
  }

  async logTrackingClick(
    applicationId: string,
    clickData: { ip: string; userAgent: string; referer: string; timestamp: Date },
  ): Promise<void> {
    const application = await this.getApplication(applicationId);
    if (!application) {
      console.error("[Tracking] Application not found:", applicationId);
      return;
    }

    const ua = clickData.userAgent || "";
    const uaLower = ua.toLowerCase();
    const deviceType = uaLower.includes("mobile")
      ? "mobile"
      : uaLower.includes("tablet")
      ? "tablet"
      : "desktop";
    const browser = ua.includes("Chrome")
      ? "Chrome"
      : ua.includes("Firefox")
      ? "Firefox"
      : ua.includes("Safari")
      ? "Safari"
      : "Other";

    const geo = geoip.lookup(clickData.ip);
    const country = geo?.country || "Unknown";
    const city = geo?.city || "Unknown";

    await db.insert(clickEvents).values({
      id: randomUUID(),
      applicationId,
      offerId: application.offerId,
      creatorId: application.creatorId,
      ipAddress: clickData.ip,
      userAgent: ua,
      referer: clickData.referer,
      country,
      city,
      timestamp: new Date(),
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const uniqueIpsToday = await db
      
      .selectDistinct({ ipAddress: clickEvents.ipAddress })
      .from(clickEvents)
      .where(and(eq(clickEvents.applicationId, applicationId), sql`${clickEvents.timestamp}::date = ${today}::date`));

    const existing = await db
      .select()
      .from(analytics)
      .where(and(eq(analytics.applicationId, applicationId), eq(analytics.date, today)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(analytics)
        .set({
          clicks: sql`${analytics.clicks} + 1`,
          uniqueClicks: uniqueIpsToday.length,
        })
        .where(eq(analytics.id, existing[0].id));
    } else {
      await db.insert(analytics).values({
        id: randomUUID(),
        applicationId,
        offerId: application.offerId,
        creatorId: application.creatorId,
        date: today,
        clicks: 1,
        uniqueClicks: uniqueIpsToday.length,
        conversions: 0,
        earnings: "0",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log(
      `[Tracking] Logged click for application ${applicationId} from ${city}, ${country} - IP: ${clickData.ip}`,
    );
  }

  // Record Conversion and Calculate Earnings
  async recordConversion(applicationId: string, saleAmount?: number): Promise<void> {
    const application = await this.getApplication(applicationId);
    if (!application) {
      console.error("[Conversion] Application not found:", applicationId);
      return;
    }

    const offer = await this.getOffer(application.offerId);
    if (!offer) {
      console.error("[Conversion] Offer not found:", application.offerId);
      return;
    }

    let earnings = 0;

    switch (offer.commissionType) {
      case "per_sale":
        if (!saleAmount || !offer.commissionPercentage) {
          console.error("[Conversion] Sale amount required for per_sale commission");
          return;
        }
        earnings = (saleAmount * parseFloat(offer.commissionPercentage.toString())) / 100;
        break;

      case "per_lead":
      case "per_click":
        if (!offer.commissionAmount) {
          console.error("[Conversion] Commission amount not set");
          return;
        }
        earnings = parseFloat(offer.commissionAmount.toString());
        break;

      case "monthly_retainer":
        console.log("[Conversion] Retainer payments handled via deliverable approval");
        return;

      case "hybrid":
        if (offer.commissionAmount) {
          earnings = parseFloat(offer.commissionAmount.toString());
        } else if (saleAmount && offer.commissionPercentage) {
          earnings = (saleAmount * parseFloat(offer.commissionPercentage.toString())) / 100;
        }
        break;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await db
      .select()
      .from(analytics)
      .where(and(eq(analytics.applicationId, applicationId), eq(analytics.date, today)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(analytics)
        .set({
          conversions: sql`${analytics.conversions} + 1`,
          earnings: sql`${analytics.earnings} + ${earnings.toFixed(2)}`,
        })
        .where(eq(analytics.id, existing[0].id));
    } else {
      await db.insert(analytics).values({
        id: randomUUID(),
        applicationId,
        offerId: application.offerId,
        creatorId: application.creatorId,
        date: today,
        clicks: 0,
        uniqueClicks: 0,
        conversions: 1,
        earnings: earnings.toFixed(2),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Calculate fees according to spec: 7% total (4% platform + 3% Stripe)
    const platformFee = earnings * 0.04; // 4% platform fee
    const stripeFee = earnings * 0.03;   // 3% Stripe processing fee
    const netAmount = earnings - platformFee - stripeFee;

    await this.createPayment({
      applicationId: applicationId,
      creatorId: application.creatorId,
      companyId: offer.companyId,
      offerId: application.offerId,
      grossAmount: earnings.toFixed(2),
      platformFeeAmount: platformFee.toFixed(2),
      stripeFeeAmount: stripeFee.toFixed(2),
      netAmount: netAmount.toFixed(2),
      status: "pending",
      description: `Commission for ${offer.commissionType} conversion`,
    });

    console.log(
      `[Conversion] Recorded conversion for application ${applicationId} - Gross: $${earnings.toFixed(2)}, Platform Fee (4%): $${platformFee.toFixed(2)}, Stripe Fee (3%): $${stripeFee.toFixed(2)}, Net: $${netAmount.toFixed(2)}`,
    );
  }

  // Payment Settings
  async getPaymentSettings(userId: string): Promise<PaymentSetting[]> {
    return await db
      .select()
      .from(paymentSettings)
      .where(eq(paymentSettings.userId, userId))
      .orderBy(desc(paymentSettings.createdAt));
  }

  async createPaymentSetting(setting: InsertPaymentSetting): Promise<PaymentSetting> {
    const result = await db
      .insert(paymentSettings)
      .values({
        ...setting,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async deletePaymentSetting(id: string): Promise<void> {
    await db.delete(paymentSettings).where(eq(paymentSettings.id, id));
  }

  // Payments
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await db
      .insert(payments)
      .values({
        ...payment,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return result[0];
  }

  async getPaymentsByCreator(creatorId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.creatorId, creatorId))
      .orderBy(desc(payments.createdAt));
  }

  async getPaymentsByCompany(companyId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.companyId, companyId))
      .orderBy(desc(payments.createdAt));
  }

  async getAllPayments(): Promise<any[]> {
    return await db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async updatePaymentStatus(
    id: string,
    status: string,
    updates?: Partial<InsertPayment>,
  ): Promise<Payment | undefined> {
    const result = await db
      .update(payments)
      .set({
        status: status as any,
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();
    return result[0];
  }

  // Retainer Contracts
  async getRetainerContract(id: string): Promise<any> {
    const result = await db
      .select()
      .from(retainerContracts)
      .leftJoin(companyProfiles, eq(retainerContracts.companyId, companyProfiles.id))
      .leftJoin(users, eq(companyProfiles.userId, users.id))
      .where(eq(retainerContracts.id, id))
      .limit(1);

    if (result.length === 0) return undefined;

    return {
      ...result[0].retainer_contracts,
      company: result[0].company_profiles,
      companyUser: result[0].users,
    };
  }

  async getRetainerContracts(filters?: any): Promise<any[]> {
    let query = db
      .select()
      .from(retainerContracts)
      .leftJoin(companyProfiles, eq(retainerContracts.companyId, companyProfiles.id))
      .leftJoin(users, eq(companyProfiles.userId, users.id));

    if (filters?.status) {
      query = (query.where(eq(retainerContracts.status, filters.status)) as unknown) as typeof query;
    }

    const results = await query.orderBy(desc(retainerContracts.createdAt));

    return results.map((r: any) => ({
      ...r.retainer_contracts,
      company: r.company_profiles,
      companyUser: r.users,
    }));
  }

  async getRetainerContractsByCompany(companyId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerContracts)
      .where(eq(retainerContracts.companyId, companyId))
      .orderBy(desc(retainerContracts.createdAt));

    return results;
  }

  async getRetainerContractsByCreator(creatorId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerContracts)
      .leftJoin(companyProfiles, eq(retainerContracts.companyId, companyProfiles.id))
      .where(eq(retainerContracts.assignedCreatorId, creatorId))
      .orderBy(desc(retainerContracts.createdAt));

    return results.map((r: any) => ({
      ...r.retainer_contracts,
      company: r.company_profiles,
    }));
  }

  async getOpenRetainerContracts(): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerContracts)
      .leftJoin(companyProfiles, eq(retainerContracts.companyId, companyProfiles.id))
      .leftJoin(users, eq(companyProfiles.userId, users.id))
      .where(eq(retainerContracts.status, "open"))
      .orderBy(desc(retainerContracts.createdAt));

    return results.map((r: any) => ({
      ...r.retainer_contracts,
      company: r.company_profiles,
      companyUser: r.users,
    }));
  }

  async createRetainerContract(contract: InsertRetainerContract): Promise<RetainerContract> {
    const result = await db
      .insert(retainerContracts)
      .values({
        ...contract,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateRetainerContract(
    id: string,
    updates: Partial<InsertRetainerContract>,
  ): Promise<RetainerContract | undefined> {
    const result = await db
      .update(retainerContracts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(retainerContracts.id, id))
      .returning();
    return result[0];
  }

  async deleteRetainerContract(id: string): Promise<void> {
    await db.delete(retainerContracts).where(eq(retainerContracts.id, id));
  }

  // Retainer Applications
  async getRetainerApplication(id: string): Promise<any> {
    const result = await db
      .select()
      .from(retainerApplications)
      .leftJoin(users, eq(retainerApplications.creatorId, users.id))
      .leftJoin(creatorProfiles, eq(users.id, creatorProfiles.userId))
      .leftJoin(retainerContracts, eq(retainerApplications.contractId, retainerContracts.id))
      .where(eq(retainerApplications.id, id))
      .limit(1);

    if (result.length === 0) return undefined;

    return {
      ...result[0].retainer_applications,
      creator: result[0].users,
      creatorProfile: result[0].creator_profiles,
      contract: result[0].retainer_contracts,
    };
  }

  async getRetainerApplicationsByContract(contractId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerApplications)
      .leftJoin(users, eq(retainerApplications.creatorId, users.id))
      .leftJoin(creatorProfiles, eq(users.id, creatorProfiles.userId))
      .where(eq(retainerApplications.contractId, contractId))
      .orderBy(desc(retainerApplications.createdAt));

    return results.map((r: any) => ({
      ...r.retainer_applications,
      creator: r.users,
      creatorProfile: r.creator_profiles,
    }));
  }

  async getRetainerApplicationsByCreator(creatorId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerApplications)
      .leftJoin(retainerContracts, eq(retainerApplications.contractId, retainerContracts.id))
      .leftJoin(companyProfiles, eq(retainerContracts.companyId, companyProfiles.id))
      .where(eq(retainerApplications.creatorId, creatorId))
      .orderBy(desc(retainerApplications.createdAt));

    return results.map((r: any) => ({
      ...r.retainer_applications,
      contract: r.retainer_contracts,
      company: r.company_profiles,
    }));
  }

  async createRetainerApplication(application: InsertRetainerApplication): Promise<RetainerApplication> {
    const result = await db
      .insert(retainerApplications)
      .values({
        ...application,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateRetainerApplication(
    id: string,
    updates: Partial<InsertRetainerApplication>,
  ): Promise<RetainerApplication | undefined> {
    const result = await db
      .update(retainerApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(retainerApplications.id, id))
      .returning();
    return result[0];
  }

  async approveRetainerApplication(
    id: string,
    contractId: string,
    creatorId: string,
  ): Promise<RetainerApplication | undefined> {
    const appResult = await db
      .update(retainerApplications)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(retainerApplications.id, id))
      .returning();

    await db
      .update(retainerContracts)
      .set({
        assignedCreatorId: creatorId,
        status: "in_progress",
        startDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(retainerContracts.id, contractId));

    return appResult[0];
  }

  async rejectRetainerApplication(id: string): Promise<RetainerApplication | undefined> {
    const result = await db
      .update(retainerApplications)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(retainerApplications.id, id))
      .returning();
    return result[0];
  }

  // Retainer Deliverables
  async getRetainerDeliverable(id: string): Promise<any> {
    const result = await db
      .select()
      .from(retainerDeliverables)
      .where(eq(retainerDeliverables.id, id))
      .limit(1);
    return result[0];
  }

  async getRetainerDeliverablesByContract(contractId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerDeliverables)
      .where(eq(retainerDeliverables.contractId, contractId))
      .orderBy(desc(retainerDeliverables.submittedAt));
    return results;
  }

  async getRetainerDeliverablesByCreator(creatorId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerDeliverables)
      .leftJoin(retainerContracts, eq(retainerDeliverables.contractId, retainerContracts.id))
      .where(eq(retainerDeliverables.creatorId, creatorId))
      .orderBy(desc(retainerDeliverables.submittedAt));

    return results.map((r: any) => ({
      ...r.retainer_deliverables,
      contract: r.retainer_contracts,
    }));
  }

  async getRetainerDeliverablesForMonth(contractId: string, monthNumber: number): Promise<any[]> {
    const results = await db
      .select()
      .from(retainerDeliverables)
      .where(and(eq(retainerDeliverables.contractId, contractId), eq(retainerDeliverables.monthNumber, monthNumber)))
      .orderBy(retainerDeliverables.videoNumber);
    return results;
  }

  async createRetainerDeliverable(deliverable: InsertRetainerDeliverable): Promise<RetainerDeliverable> {
    const result = await db
      .insert(retainerDeliverables)
      .values({
        ...deliverable,
        id: randomUUID(),
        createdAt: new Date(),
      })
      .returning();
    return result[0];
  }

  async updateRetainerDeliverable(
    id: string,
    updates: Partial<InsertRetainerDeliverable>,
  ): Promise<RetainerDeliverable | undefined> {
    const result = await db
      .update(retainerDeliverables)
      .set(updates)
      .where(eq(retainerDeliverables.id, id))
      .returning();
    return result[0];
  }

  async approveRetainerDeliverable(id: string, reviewNotes?: string): Promise<RetainerDeliverable | undefined> {
    const result = await db
      .update(retainerDeliverables)
      .set({
        status: "approved",
        reviewedAt: new Date(),
        reviewNotes,
      })
      .where(eq(retainerDeliverables.id, id))
      .returning();
    return result[0];
  }

  async rejectRetainerDeliverable(id: string, reviewNotes: string): Promise<RetainerDeliverable | undefined> {
    const result = await db
      .update(retainerDeliverables)
      .set({
        status: "rejected",
        reviewedAt: new Date(),
        reviewNotes,
      })
      .where(eq(retainerDeliverables.id, id))
      .returning();
    return result[0];
  }

  async requestRevision(id: string, reviewNotes: string): Promise<RetainerDeliverable | undefined> {
    const result = await db
      .update(retainerDeliverables)
      .set({
        status: "revision_requested",
        reviewedAt: new Date(),
        reviewNotes,
      })
      .where(eq(retainerDeliverables.id, id))
      .returning();
    return result[0];
  }

  async createRetainerPayment(payment: InsertRetainerPayment): Promise<RetainerPayment> {
    try {
      const result = await db
        .insert(retainerPayments)
        .values({
          ...payment,
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      if (isMissingRelationError(error, "retainer_payments")) {
        console.warn(
          "[Storage] retainer_payments relation missing while creating retainer payment - treating as no-op.",
        );
        return {
          ...payment,
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as RetainerPayment;
      }
      throw error;
    }
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    try {
      const result = await db
        .insert(notifications)
        .values({
          ...notification,
          id: randomUUID(),
          createdAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while creating notification - returning ephemeral notification.",
        );
        return buildEphemeralNotification(notification);
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while creating notification - returning ephemeral notification.",
        );
        return buildEphemeralNotification(notification);
      }
      throw error;
    }
  }

  async getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    try {
      const results = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
      return results;
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while fetching notifications - attempting legacy fallback.",
        );
        return legacyFetchNotifications(userId, { limit });
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while fetching notifications - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    try {
      const results = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
        .orderBy(desc(notifications.createdAt));
      return results;
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while fetching unread notifications - attempting legacy fallback.",
        );
        return legacyFetchUnreadNotifications(userId);
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while fetching unread notifications - returning empty array.",
        );
        return [];
      }
      throw error;
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      return coerceCount(result[0]?.count ?? 0);
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while counting unread notifications - attempting legacy fallback.",
        );
        return legacyCountUnreadNotifications(userId);
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while counting unread notifications - returning 0.",
        );
        return 0;
      }
      throw error;
    }
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    try {
      const result = await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(eq(notifications.id, id))
        .returning();
      return result[0];
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while marking notification as read - treating as already handled.",
        );
        return undefined;
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while marking notification as read - treating as already handled.",
        );
        return undefined;
      }
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while marking all notifications as read - skipping operation.",
        );
        return;
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while marking all notifications as read - skipping operation.",
        );
        return;
      }
      throw error;
    }
  }

  async deleteNotification(id: string): Promise<void> {
    try {
      await db.delete(notifications).where(eq(notifications.id, id));
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while deleting notification - skipping operation.",
        );
        return;
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while deleting notification - skipping operation.",
        );
        return;
      }
      throw error;
    }
  }

  async clearAllNotifications(userId: string): Promise<void> {
    try {
      await db.delete(notifications).where(eq(notifications.userId, userId));
    } catch (error) {
      if (isLegacyNotificationColumnError(error)) {
        console.warn(
          "[Storage] notifications column mismatch while clearing notifications - skipping operation.",
        );
        return;
      }
      if (isMissingNotificationSchema(error)) {
        console.warn(
          "[Storage] notifications relation missing while clearing notifications - skipping operation.",
        );
        return;
      }
      throw error;
    }
  }

  // User Notification Preferences
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | null> {
    try {
      const result = await db
        .select()
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.userId, userId))
        .limit(1);
      return result[0] || null;
    } catch (error) {
      if (isMissingRelationError(error, "user_notification_preferences")) {
        console.warn(
          "[Storage] user_notification_preferences relation missing while fetching preferences - returning null.",
        );
        return null;
      }
      throw error;
    }
  }

  async createUserNotificationPreferences(
    preferences: InsertUserNotificationPreferences,
  ): Promise<UserNotificationPreferences> {
    try {
      const result = await db
        .insert(userNotificationPreferences)
        .values({
          ...preferences,
          id: randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } catch (error) {
      if (isMissingRelationError(error, "user_notification_preferences")) {
        console.warn(
          "[Storage] user_notification_preferences relation missing while creating preferences - returning defaults.",
        );
        return {
          ...buildDefaultNotificationPreferences(preferences.userId),
          ...preferences,
        };
      }
      throw error;
    }
  }

  async updateUserNotificationPreferences(
    userId: string,
    updates: Partial<InsertUserNotificationPreferences>,
  ): Promise<UserNotificationPreferences | undefined> {
    try {
      const result = await db
        .update(userNotificationPreferences)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userNotificationPreferences.userId, userId))
        .returning();
      return result[0];
    } catch (error) {
      if (isMissingRelationError(error, "user_notification_preferences")) {
        console.warn(
          "[Storage] user_notification_preferences relation missing while updating preferences - returning merged defaults.",
        );
        return {
          ...buildDefaultNotificationPreferences(userId),
          ...updates,
          userId,
          updatedAt: new Date(),
        } as UserNotificationPreferences;
      }
      throw error;
    }
  }

  // Admin
  private async updateCreatorAccountStatus(
    userId: string,
    status: User["accountStatus"],
  ): Promise<User | undefined> {
    try {
      const result = await db
        .update(users)
        .set({ accountStatus: status, updatedAt: new Date() })
        .where(and(eq(users.id, userId), eq(users.role, "creator")))
        .returning();
      return result[0];
    } catch (error) {
      if (isMissingRelationError(error, "users")) {
        console.warn(
          "[Storage] users relation missing while updating creator status - treating as no-op.",
        );
        return undefined;
      }
      throw error;
    }
  }

  async getCreatorsForAdmin(): Promise<AdminCreatorSummary[]> {
    try {
      const rows = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          accountStatus: users.accountStatus,
          createdAt: users.createdAt,
          creatorProfile: creatorProfiles,
        })
        .from(users)
        .leftJoin(creatorProfiles, eq(creatorProfiles.userId, users.id))
        .where(eq(users.role, "creator"))
        .orderBy(desc(users.createdAt));

      return rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        profileImageUrl: row.profileImageUrl ?? null,
        accountStatus: row.accountStatus,
        createdAt: row.createdAt ?? null,
        profile: row.creatorProfile
          ? {
              bio: row.creatorProfile.bio ?? null,
              youtubeFollowers: row.creatorProfile.youtubeFollowers ?? null,
              tiktokFollowers: row.creatorProfile.tiktokFollowers ?? null,
              instagramFollowers: row.creatorProfile.instagramFollowers ?? null,
            }
          : null,
      }));
    } catch (error) {
      if (isMissingRelationError(error, "users") || isMissingRelationError(error, "creator_profiles")) {
        console.warn("[Storage] creator listing relations missing - returning empty creator list.");
        return [];
      }
      throw error;
    }
  }

  async suspendCreator(userId: string): Promise<User | undefined> {
    return this.updateCreatorAccountStatus(userId, "suspended");
  }

  async unsuspendCreator(userId: string): Promise<User | undefined> {
    return this.updateCreatorAccountStatus(userId, "active");
  }

  async banCreator(userId: string): Promise<User | undefined> {
    return this.updateCreatorAccountStatus(userId, "banned");
  }

  // Helper methods
  async getUserById(id: string): Promise<User | undefined> {
    return this.getUser(id);
  }

  async getAllUsers(): Promise<User[]> {
    const results = await db.select().from(users);
    return results;
  }
}

export const storage = new DatabaseStorage();