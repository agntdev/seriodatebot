import type { Ctx } from "./bot.js";

export interface Profile {
  id: string;
  telegramId: number;
  displayName: string;
  age: number;
  gender?: string;
  city?: string;
  bio?: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  language: "ru";
  notifications: boolean;
  privacy: "visible";
}

export interface Complaint {
  id: string;
  telegramId: number;
  displayName: string;
  profileId?: string;
  reason: string;
  createdAt: string;
  notifiedAdminAt?: string;
}

export interface DomainData {
  profile?: Profile;
  settings?: Settings;
  complaints: Complaint[];
}

type D1Result<T> = { results?: T[] };
type D1Statement = { bind(...values: unknown[]): D1Statement; first<T>(): Promise<T | null>; all<T>(): Promise<D1Result<T>>; run(): Promise<unknown> };
type D1Database = { prepare(sql: string): D1Statement };
type AppCtx = Ctx & { env?: { DB?: D1Database } };

let clock: () => Date = () => new Date();
export function setClock(next: () => Date): void { clock = next; }
function now(): string { return clock().toISOString(); }
function userId(ctx: Ctx): number { return ctx.from?.id ?? ctx.chat?.id ?? 0; }
function fallback(ctx: Ctx): DomainData {
  const app = ctx as AppCtx;
  if (!ctx.session.testData) ctx.session.testData = { complaints: [] };
  return ctx.session.testData;
}
function db(ctx: Ctx): D1Database | undefined { return (ctx as AppCtx).env?.DB; }

async function ensureSchema(database: D1Database): Promise<void> {
  await database.prepare("CREATE TABLE IF NOT EXISTS users (telegram_id INTEGER PRIMARY KEY, display_name TEXT NOT NULL, language TEXT NOT NULL, created_at TEXT NOT NULL, last_active TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, telegram_id INTEGER UNIQUE NOT NULL, display_name TEXT NOT NULL, age INTEGER NOT NULL, gender TEXT, city TEXT, bio TEXT, photos TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, file_id TEXT NOT NULL, caption TEXT, created_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS likes (id TEXT PRIMARY KEY, from_profile_id TEXT NOT NULL, to_profile_id TEXT NOT NULL, created_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, profile_a_id TEXT NOT NULL, profile_b_id TEXT NOT NULL, matched_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS blocks (id TEXT PRIMARY KEY, blocker_profile_id TEXT NOT NULL, blocked_profile_id TEXT NOT NULL, created_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS settings (telegram_id INTEGER PRIMARY KEY, language TEXT NOT NULL, notifications_enabled INTEGER NOT NULL, privacy TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS complaints (id TEXT PRIMARY KEY, telegram_id INTEGER NOT NULL, display_name TEXT NOT NULL, profile_id TEXT, reason TEXT NOT NULL, created_at TEXT NOT NULL, notified_admin_at TEXT)").run();
}

function rowProfile(row: Record<string, unknown>): Profile {
  return { id: String(row.id), telegramId: Number(row.telegram_id), displayName: String(row.display_name), age: Number(row.age), gender: row.gender ? String(row.gender) : undefined, city: row.city ? String(row.city) : undefined, bio: row.bio ? String(row.bio) : undefined, photos: JSON.parse(String(row.photos || "[]")) as string[], createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

export async function getProfile(ctx: Ctx): Promise<Profile | undefined> {
  const database = db(ctx);
  if (!database) return fallback(ctx).profile;
  await ensureSchema(database);
  const row = await database.prepare("SELECT * FROM profiles WHERE telegram_id = ?").bind(userId(ctx)).first<Record<string, unknown>>();
  return row ? rowProfile(row) : undefined;
}

export async function saveProfile(ctx: Ctx, profile: Profile): Promise<void> {
  const database = db(ctx);
  if (!database) { fallback(ctx).profile = profile; return; }
  await ensureSchema(database);
  const timestamp = now();
  await database.prepare("INSERT INTO users (telegram_id, display_name, language, created_at, last_active) VALUES (?, ?, ?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET display_name=excluded.display_name, last_active=excluded.last_active").bind(profile.telegramId, profile.displayName, "ru", profile.createdAt, timestamp).run();
  await database.prepare("INSERT INTO profiles (id, telegram_id, display_name, age, gender, city, bio, photos, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET display_name=excluded.display_name, age=excluded.age, gender=excluded.gender, city=excluded.city, bio=excluded.bio, photos=excluded.photos, updated_at=excluded.updated_at").bind(profile.id, profile.telegramId, profile.displayName, profile.age, profile.gender ?? null, profile.city ?? null, profile.bio ?? null, JSON.stringify(profile.photos), profile.createdAt, profile.updatedAt).run();
  await database.prepare("DELETE FROM photos WHERE profile_id = ?").bind(profile.id).run();
  for (const fileId of profile.photos) await database.prepare("INSERT INTO photos (id, profile_id, file_id, created_at) VALUES (?, ?, ?, ?)").bind(makeId("photo"), profile.id, fileId, timestamp).run();
}

export async function deleteProfile(ctx: Ctx): Promise<void> {
  const database = db(ctx);
  if (!database) { fallback(ctx).profile = undefined; fallback(ctx).settings = undefined; return; }
  await ensureSchema(database);
  const profile = await getProfile(ctx);
  if (profile) {
    await database.prepare("DELETE FROM photos WHERE profile_id = ?").bind(profile.id).run();
    await database.prepare("DELETE FROM likes WHERE from_profile_id = ? OR to_profile_id = ?").bind(profile.id, profile.id).run();
    await database.prepare("DELETE FROM matches WHERE profile_a_id = ? OR profile_b_id = ?").bind(profile.id, profile.id).run();
    await database.prepare("DELETE FROM blocks WHERE blocker_profile_id = ? OR blocked_profile_id = ?").bind(profile.id, profile.id).run();
  }
  await database.prepare("DELETE FROM profiles WHERE telegram_id = ?").bind(userId(ctx)).run();
  await database.prepare("DELETE FROM settings WHERE telegram_id = ?").bind(userId(ctx)).run();
}

export async function getSettings(ctx: Ctx): Promise<Settings> {
  const database = db(ctx);
  if (!database) return fallback(ctx).settings ?? { language: "ru", notifications: true, privacy: "visible" };
  await ensureSchema(database);
  const row = await database.prepare("SELECT * FROM settings WHERE telegram_id = ?").bind(userId(ctx)).first<Record<string, unknown>>();
  return row ? { language: "ru", notifications: Boolean(row.notifications_enabled), privacy: "visible" } : { language: "ru", notifications: true, privacy: "visible" };
}

export async function saveSettings(ctx: Ctx, settings: Settings): Promise<void> {
  const database = db(ctx);
  if (!database) { fallback(ctx).settings = settings; return; }
  await ensureSchema(database);
  await database.prepare("INSERT INTO settings (telegram_id, language, notifications_enabled, privacy) VALUES (?, ?, ?, ?) ON CONFLICT(telegram_id) DO UPDATE SET language=excluded.language, notifications_enabled=excluded.notifications_enabled, privacy=excluded.privacy").bind(userId(ctx), settings.language, settings.notifications ? 1 : 0, settings.privacy).run();
}

export async function saveComplaint(ctx: Ctx, complaint: Complaint): Promise<void> {
  const database = db(ctx);
  if (!database) { fallback(ctx).complaints.push(complaint); return; }
  await ensureSchema(database);
  await database.prepare("INSERT INTO complaints (id, telegram_id, display_name, profile_id, reason, created_at, notified_admin_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(complaint.id, complaint.telegramId, complaint.displayName, complaint.profileId ?? null, complaint.reason, complaint.createdAt, complaint.notifiedAdminAt ?? null).run();
}

export function makeId(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }
export function createdAt(): string { return now(); }
export function currentUserId(ctx: Ctx): number { return userId(ctx); }
