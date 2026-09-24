# Серьёзные знакомства — Bot specification

**Archetype:** community

**Voice:** warm and encouraging — write every user-facing message, button label, error, and empty state in this voice.

Телеграм-бот для взрослых, ищущих долгосрочные серьёзные отношения. Фаза 1: хранение постоянных данных, регистрация профиля (1 профиль на пользователя), загрузка фото, главное меню и базовые настройки; функции знакомства/матчинга остаются заглушками до следующих фаз.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Взрослые, ищущие долгосрочные серьёзные отношения
- Пользователи Telegram, предпочитающие приватные и простые интерфейсы

## Success criteria

- Пользователь может пройти регистрацию и создать ровно один профиль, включающий минимум display name и age
- Пользователь может добавить до 8 фото и просматривать/редактировать/удалять свой профиль
- Главное меню корректно показывает опции доступные до и после регистрации (кнопки активны/неактивны)
- Жалобы/критические ошибки доставляются владельцу в ADMIN_CHAT_ID
- Все сущности (User, Profile, Photo, Like, Match, Settings, Complaint, Block) сохраняются в БД и переживают рестарты сервиса

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Открыть главное меню (не создаёт профиль автоматически)
- **👤 Создать анкету** (button, actor: user, callback: profile:create:start) — Запустить пошаговую регистрацию профиля (required fields + фото)
  - inputs: display_name (text via ForceReply), age (number via ForceReply), gender (button 선택 optional), city (text optional), bio (text optional), photos (user sends up to 8 photos — bot stores file_id)
  - outputs: Profile.created (persistent), User.created or User.linked, Confirmation message and switch of main menu to '👤 Моя анкета'
- **👤 Моя анкета** (button, actor: user, callback: profile:view) — Посмотреть и редактировать свой профиль (показано только если профиль есть)
  - outputs: Profile snapshot message with inline buttons: Edit, Manage photos, Delete profile
- **🔎 Знакомства** (button, actor: user, callback: discover:disabled) — Заглушка — отключено пока профиль не создан (показывает подсказку создать профиль)
  - outputs: Prompt to create a profile or explanation that feature coming soon
- **⚙️ Настройки** (button, actor: user, callback: settings:open) — Открыть минимальные настройки: язык (RU по умолчанию), уведомления, приватность
  - inputs: language selection (buttons), notifications toggle (buttons)
  - outputs: Settings.updated (persistent)
- **🆘 Помощь** (button, actor: user, callback: help:open) — Показать статический текст помощи и кнопку для отправки жалобы/ошибки
  - outputs: Help text message, If 'Report an issue' pressed -> ForceReply to collect reason -> create Complaint and notify ADMIN_CHAT_ID

## Flows

### Registration (Create Profile)
_Trigger:_ callback profile:create:start

1. Check if User (telegram_id) already has a Profile; if yes, show 'You already have a profile' and link to '👤 Моя анкета'
2. If no, start guided dialog using ForceReply for display name and age (required). Use inline button choices for gender (optional). Collect optional city and bio via ForceReply.
3. Prompt user to upload up to 8 photos (each incoming photo saved by file_id). Allow 'Skip' or 'Finish' button at any time.
4. Validate age is numeric and within reasonable bounds (assumption: 18+). If invalid, show friendly error in Russian and re-prompt.
5. On completion, create Profile entity linked to User (one-to-one), save Settings defaults, send confirmation, and update main menu to show '👤 Моя анкета'.

_Data touched:_ User, Profile, Photo, Settings

### View & Edit Own Profile
_Trigger:_ callback profile:view

1. Fetch Profile by Telegram user id; if not found, prompt to create profile.
2. Render profile summary (display_name, age, gender, city, bio, photo thumbnails using file_id).
3. Provide inline buttons: Edit fields (starts field-specific ForceReply flows), Manage photos (add/delete), Delete profile (confirmation yes/no).
4. Edits update Profile and Settings in DB and confirm to user.

_Data touched:_ Profile, Photo, Settings

### Report Complaint / Send Support Message
_Trigger:_ help -> report button -> ForceReply

1. Collect complaint reason via ForceReply (short text).
2. Create Complaint entity with reporter_profile_id (or null if reporter has no profile), target_profile_id if provided, and reason.
3. Store complaint persistently and send notification message to ADMIN_CHAT_ID with complaint details and reporter contact (telegram id & display name).
4. Acknowledge receipt to user in Russian.

_Data touched:_ Complaint, User, Profile

### Delete Profile
_Trigger:_ callback profile:delete -> confirm

1. Ask for explicit confirmation with inline buttons Yes/No.
2. On Yes: delete Profile and associated Photos, Likes, Matches, Blocks and Settings for that Profile (logical delete or hard delete per persistence implementation), mark User as having no profile.
3. Notify user of successful deletion and update main menu to pre-registration state; notify admin of profile deletion if admin notifications enabled for critical events.

_Data touched:_ Profile, Photo, Like, Match, Block, Settings

### Main Menu Rendering
_Trigger:_ /start or menu refresh

1. Detect whether the Telegram user has a Profile.
2. Render main menu with inline buttons. If no profile: show '👤 Создать анкету' active and '🔎 Знакомства' / '🔍 Поиск' disabled (buttons that show prompt to create profile). If profile exists: show '👤 Моя анкета' and placeholders for other features.
3. Each button triggers corresponding callback flows.

_Data touched:_ User, Profile, Settings

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Куда отправлять жалобы пользователей и критические ошибки (Telegram chat id владельца)
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **User** _(retention: persistent)_ — Telegram account wrapper — one per telegram_id using the bot
  - fields: telegram_id, display_name, language, created_at, last_active
- **Profile** _(retention: persistent)_ — One profile per User containing public-facing dating info
  - fields: profile_id, user_telegram_id, display_name, age, gender, city, bio, photos[] (photo ids), visibility_settings, created_at, updated_at
- **Photo** _(retention: persistent)_ — Photo attached to a Profile; stored as Telegram file_id reference
  - fields: photo_id, owner_profile_id, file_id, caption, created_at
- **Like** _(retention: persistent)_ — A like from one profile to another (phase-1 stored but UI disabled)
  - fields: like_id, from_profile_id, to_profile_id, created_at
- **Match** _(retention: persistent)_ — Record of mutual like (placeholder for future features)
  - fields: match_id, profile_a_id, profile_b_id, matched_at
- **Settings** _(retention: persistent)_ — Per-user preferences for notifications and language
  - fields: settings_id, profile_id or user_telegram_id, language, notifications_enabled, search_preferences
- **Complaint** _(retention: persistent)_ — User-submitted report or support message delivered to admin
  - fields: complaint_id, reporter_profile_id, target_profile_id (optional), reason_text, created_at, notified_admin_at
- **Block** _(retention: persistent)_ — Block relationship between two profiles
  - fields: block_id, blocker_profile_id, blocked_profile_id, created_at

## Integrations

- **Telegram** (required) — Bot API messaging, file storage and user identity
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Provide ADMIN_CHAT_ID to receive complaints and critical alerts
- Receive complaint notifications and critical error alerts by Telegram message
- Owner may request full data export (not implemented by default — add as separate feature later)
- Owner can moderate users by sending admin commands (future): delete profile by telegram id, mute user (placeholder)

## Notifications

- Send admin notification to ADMIN_CHAT_ID when a Complaint is created (include reporter telegram id, display name, reason, optional target profile id)
- Send admin notification to ADMIN_CHAT_ID for critical runtime errors (exceptions affecting persistence or message handling)
- Acknowledge to user on profile create/edit/delete and on complaint submission

## Permissions & privacy

- Store only the listed entities; photos stored by Telegram file_id references (no external image hosting)
- One profile per Telegram user enforced by telegram_id check
- Users can delete their profile which removes profile-level data and associated photos/relations
- Default language Russian; all user-facing text and buttons in Russian
- No sharing of user data to third parties; admin receives complaints and critical alerts only

## Edge cases

- User attempts to create a second profile: reject and show link to existing profile
- User uploads non-photo or too many photos: validate and respond in Russian; allow removing extras
- Telegram file_id becomes invalid (file expired or deleted): show broken image placeholder and allow user to re-upload
- Admin not set (ADMIN_CHAT_ID missing): log critical alert internally and mark notifications as undeliverable; treat as deploy-time error
- Simultaneous registration requests (race): ensure DB uniqueness on telegram_id/profile unique constraint to prevent duplicates
- User attempts to report without a profile: allow anonymous complaint but store reporter telegram id and notify admin

## Required tests

- Dialog-level acceptance test: new user runs /start -> Create Profile -> completes required fields -> confirmation and main menu updates to show 'Моя анкета'
- Photo persistence test: upload 3 photos during registration, restart service, retrieve profile and ensure file_id references still presented
- Duplicate registration prevention: attempt second registration from same telegram id and assert rejection
- Complaint flow test: submit complaint from user, ensure Complaint is persisted and admin notification message delivered to ADMIN_CHAT_ID
- Profile deletion test: delete profile and assert associated Photos/Likes/Blocks/Matches removed or marked deleted and main menu returns to pre-registration state
- Menu state test: /start shows correct enabled/disabled buttons depending on profile existence

## Assumptions

- Default language is Russian and all messages/buttons will be written in Russian
- Age validation enforces 18+; exact bounds and enforcement policy to be implemented as simple numeric check unless owner specifies otherwise
- No external identity verification is implemented in phase 1; 'real users only' is enforced operationally (owner moderates complaints) rather than by automated verification
- Photos are stored only as Telegram file_id; the bot does not replicate binary blobs to external storage in phase 1
- Persistence layer (DB) and schema migrations are available to implement the listed entities; choice of DB is left to implementer
