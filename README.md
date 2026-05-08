# Subscription Management Tool

A production-ready subscription management web application built with **Next.js 16**, **TypeScript**, **Tailwind CSS**, and **Supabase** for secure authentication and data storage.

## Features

- **Subscription CRUD Operations** - Create, read, update, and delete subscriptions with full audit logging
- **Supabase Authentication** - Email/password sign-in with secure session management
- **Role-Based Access Control** - Admin users manage other users; regular users manage only their subscriptions
- **Auto-Renewal Triggers** - Subscriptions automatically renew on renewal date if not deleted
- **Audit Logging** - Complete change history for all subscription modifications
- **Performance Caching** - In-memory cache layer with TTL and pattern-based invalidation
- **Row-Level Security** - Database policies prevent unauthorized access at the data layer
- **Production Build Optimization** - Webpack compilation with 0 build errors

## Prerequisites

- **Node.js** 18+ and npm
- **Supabase Account** (free tier available at https://supabase.com)

## Quick Setup

### 1. Clone & Install

```bash
npm install
```

### 2. Create Database Schema in Supabase

1. Log in to your **Supabase project**
2. Go to **SQL Editor** and create a new query
3. Copy the entire contents of `migrations/001_initial_schema.sql` from this repository
4. Paste into the SQL editor and run
5. This creates: `profiles`, `subscriptions`, `audit_logs`, `sessions` tables with RLS policies, triggers, and indexes

### 3. Set Up Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update `.env.local` with your Supabase credentials:

```
# Generate a long random string (32+ characters)
AUTH_SECRET=your-random-secret-string-here-32-chars-minimum

# From Supabase Project Settings > API:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Cache settings (optional)
CACHE_TTL_SECONDS=300
ENABLE_CACHE=true
```

**Finding Your Credentials:**
- Go to **Supabase Project Settings** → **API**
- Copy `Project URL` → `SUPABASE_URL`
- Copy `anon public` key → `SUPABASE_ANON_KEY`
- Copy `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **Keep this secret!**

### 4. Create Your First User in Supabase

1. Go to **Supabase Authentication** → **Users**
2. Click **+ Create New User**
3. Enter an email and password (this will be your login account)
4. Check **Auto confirm user** (for development)
5. Click **Create User**

### 5. Run the Development Server

```bash
npm run dev
```

Open http://localhost:3000 and log in with your Supabase credentials.

## Architecture

### Session & Authentication

- Signed HTTP-only cookies using HMAC-SHA256
- Session payload: `{userId, email, expiresAt}` (base64url-encoded + signed)
- Verified against Supabase Auth on each request
- Server-side route protection on all authenticated pages

### Database Schema

**Profiles Table** - Maps Supabase Auth users to app roles:
- `user_id` (UUID, FK to auth.users)
- `role` (admin | user)
- `is_active` (boolean)
- `full_name` (text)
- `created_by` (UUID of admin who created user)
- `created_at`, `updated_at` (timestamps)

**Subscriptions Table** - Core subscription data:
- `id` (UUID, primary key)
- `user_id` (UUID, FK to profiles)
- `name`, `cost`, `billingCycle` (monthly|quarterly|yearly), `renewalDate`
- `team`, `owner`, `status` (active|cancelled), `payment_status` (paid|due|unpaid|skipped), `notes`
- `auto_renew` (boolean), `last_paid_at` (timestamp), `last_renewed_at` (timestamp)
- `subscription_renewal_events` stores paid, due, unpaid, skipped, and cancelled renewal cycles

**Audit Logs** - Complete change history:
- Logs all CREATE/UPDATE/DELETE on subscriptions
- Stores `old_values` and `new_values` as JSONB
- Tracks `user_id` and `action`
- Queryable by resource_type, action, user_id

**Sessions Table** - Active session tracking:
- Stores session tokens with expiration
- Tracks last activity for security

### Row-Level Security (RLS)

All tables have RLS policies enabled:
- Users see only **their own subscriptions** and profile
- **Admin users** see all subscriptions and users
- Policies enforced at database level (queryable data = authorized data)

### Auto-Renewal Trigger

Scheduled PostgreSQL function `process_due_subscription_renewals()` handles renewals:
- If `renewalDate` is due, `status` = active, and the cycle is inside the grace period:
  - Create a due renewal event
  - Set `payment_status = due`
  - Keep the current renewal date open for admin review
- If `renewalDate` is due, `status` = active, `auto_renew` = true, and the grace period has expired:
  - Create a paid renewal event
  - Monthly subscriptions: advance renewalDate by 1 month
  - Quarterly subscriptions: advance renewalDate by 3 months
  - Yearly subscriptions: advance renewalDate by 1 year
  - Set `payment_status = paid`, `last_paid_at = now()`, and `last_renewed_at = now()`
- If `auto_renew` = false:
  - Create a due renewal event
  - Set `payment_status = due`
  - Keep the renewal date for admin review
- Grace defaults to 7 days and can be changed in Settings, including `never` to keep current-cycle payment edits open indefinitely.

See `RENEWAL_SETUP.md` for the Supabase cron setup.

### Caching Layer

In-memory cache with TTL support:
- Cache key format: `subscriptions:<userId>` or `users:list`
- Default TTL: 300 seconds (configurable)
- Automatic invalidation on create/update/delete operations
- Pattern-based invalidation: `invalidateCache("subscriptions:*")` invalidates all user subscription caches

## API Endpoints

All endpoints require valid session cookie. Protected behind `verifyRequestSession()`.

### Subscriptions

**GET /api/subscriptions**
- Returns user's subscriptions (or all if admin), sorted by renewal date
- Response: `{subscriptions: [...]}`

**POST /api/subscriptions**
- Create new subscription (auto-assigned to current user)
- Body: `{name, cost, billingCycle, renewalDate, team, owner, status, notes}`
- Response: `{subscription: {...}}` (status 201)

**PUT /api/subscriptions**
- Update subscription (requires ownership or admin)
- Body: `{id, ...updateFields}`
- Response: `{subscription: {...}}`

**DELETE /api/subscriptions?id=<subscriptionId>**
- Delete subscription (requires ownership or admin)
- Response: `{ok: true}`

### Users (Admin Only)

**POST /api/users**
- Create new user in Supabase Auth (admin only)
- Body: `{email, password, full_name}`
- Response: `{user: {...}}` (status 201)

**GET /api/users**
- List all users (admin only)
- Response: `{users: [...]}`

**PATCH /api/users**
- Update user role/is_active status (admin only)
- Body: `{user_id, role?, is_active?}`
- Response: `{user: {...}}`

### Authentication

**POST /api/auth/login**
- Sign in with Supabase Auth
- Body: `{email, password}`
- Response: Sets secure session cookie, returns `{user: {...}}`

**POST /api/auth/logout**
- Clear session cookie
- Response: `{ok: true}`

## Deployment

### Vercel

1. Push repository to GitHub
2. Import project in Vercel dashboard
3. Set environment variables in **Settings → Environment Variables**:
   ```
   AUTH_SECRET=<your-secret>
   SUPABASE_URL=<url>
   SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ENABLE_CACHE=true
   CACHE_TTL_SECONDS=300
   ```
4. Deploy
5. In your Supabase project, add Vercel domain to **Auth → URL Configuration → Site URL** and **Redirect URLs**

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next .next
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Considerations

- **Cache in Production** - Currently in-memory only. For scaling beyond one instance, consider Redis-backed cache (cache utilities designed to support this)
- **Session Cleanup** - Database has `cleanup_expired_sessions()` function but no cron trigger. In production, set up a cron job or use Supabase Edge Functions to call periodically
- **Audit Logs** - Accumulates indefinitely. Plan for log archival/retention policies

## Development

### Build

```bash
npm run build
```

Uses Webpack (not Turbopack due to CSS processing compatibility).

### Lint

```bash
npm run lint
```

Runs ESLint 9 (no errors tolerated on main branch).

### Type Check

TypeScript checking runs automatically during build.

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/login, logout
│   │   ├── subscriptions (full CRUD)
│   │   └── users (admin endpoints)
│   ├── login, dashboard, add (pages)
│   └── globals.css, layout.tsx
├── components/
│   ├── subscription-table, subscription-form
│   ├── login-form, logout-button
│   └── app-header
├── lib/
│   ├── auth.ts (session management)
│   ├── data.ts (validation, legacy JSON support)
│   ├── types.ts (TypeScript interfaces)
│   ├── supabase.ts (client initialization)
│   ├── permissions.ts (role checks, ownership verification)
│   ├── cache.ts (in-memory caching with TTL)
│   └── subscription-helpers.ts (sorting, filtering)
└── migrations/
    └── 001_initial_schema.sql (full database schema)
```

## Known Limitations

- **In-Memory Cache** - Does not persist across server restarts. Suitable for development and small deployments. Upgrade to Redis for production scaling
- **Session Cleanup** - Expired sessions not automatically cleaned. Implement cron job for cleanup
- **Email Verification** - Auth users not required to verify email. Configure in Supabase Auth settings for production

## Troubleshooting

**Build Error: "Failed to write app endpoint /page"**
- Use `npm run build --webpack` instead of default next build

**Database Connection Error**
- Verify `SUPABASE_URL` and keys are correct
- Check that Supabase project is active
- Run schema migration in SQL Editor

**Login Not Working**
- Ensure user was created in Supabase Authentication (not manually in profiles table)
- Check `SUPABASE_ANON_KEY` is correct
- Verify user's email in Authentication dashboard

**Permission Denied on Subscriptions**
- Check RLS policies in Supabase (should be automatically created by schema)
- Verify user's role in `profiles` table
- For admin access, ensure user's profile has `role = 'admin'`

## License

MIT
