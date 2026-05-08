# Setup Checklist

Follow these steps to get the subscription management tool running:

## Prerequisites
- [ ] Node.js 18+ installed
- [ ] Supabase account created (https://supabase.com)
- [ ] New Supabase project created

## Step 1: Install Dependencies
```bash
npm install
```
- [ ] Dependencies installed successfully

## Step 2: Create Database Schema
1. [ ] Open your Supabase project dashboard
2. [ ] Navigate to **SQL Editor**
3. [ ] Create a new query
4. [ ] Copy entire contents from `migrations/001_initial_schema.sql`
5. [ ] Paste into SQL Editor and click **Run**
6. [ ] Verify tables created: `profiles`, `subscriptions`, `audit_logs`, `sessions`

## Step 3: Get Supabase Credentials
1. [ ] Go to **Project Settings** → **API**
2. [ ] Copy **Project URL** → Save as `SUPABASE_URL`
3. [ ] Copy **anon public key** → Save as `SUPABASE_ANON_KEY`
4. [ ] Copy **service_role secret key** → Save as `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

## Step 4: Create Environment File
1. [ ] Run: `cp .env.example .env.local`
2. [ ] Open `.env.local` and update:
   - [ ] `AUTH_SECRET` - Generate a random 32+ character string
   - [ ] `SUPABASE_URL` - Paste your Project URL
   - [ ] `SUPABASE_ANON_KEY` - Paste your anon key
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` - Paste your service role key
   - [ ] `CACHE_TTL_SECONDS` - Keep as 300 (optional)
   - [ ] `ENABLE_CACHE` - Keep as true (optional)

## Step 5: Create First User in Supabase Auth
1. [ ] Go to **Supabase Authentication** → **Users**
2. [ ] Click **+ Create New User**
3. [ ] Enter email address (e.g., `admin@example.com`)
4. [ ] Enter password (e.g., `TempPassword123!`)
5. [ ] Check **Auto confirm user**
6. [ ] Click **Create User**
7. [ ] Save email and password for login testing

## Step 6: Start Development Server
```bash
npm run dev
```
- [ ] Server running at `http://localhost:3000`
- [ ] No build errors
- [ ] Terminal shows "ready - started server on 0.0.0.0:3000"

## Step 7: Test Login
1. [ ] Open `http://localhost:3000`
2. [ ] You should see login page
3. [ ] Enter the Supabase user email and password from Step 5
4. [ ] Click **Sign In**
5. [ ] Should redirect to dashboard

## Step 8: Test Subscription Creation
1. [ ] Click **+ Add Subscription** button
2. [ ] Fill in subscription form:
   - [ ] Name: e.g., "Netflix"
   - [ ] Cost: e.g., "15.99"
   - [ ] Billing Cycle: Select "Monthly", "Quarterly", or "Yearly"
   - [ ] Renewal Date: Pick a date
   - [ ] Team: e.g., "Entertainment"
   - [ ] Owner: e.g., "John Doe"
   - [ ] Status: Select "Active"
3. [ ] Click **Add Subscription**
4. [ ] Should redirect to dashboard and see new subscription in table

## Step 9: Test Admin Features (Optional)
To test admin/user management features, create an admin user:

1. [ ] In Supabase, go to **SQL Editor** → **New Query**
2. [ ] Run this query to make your user an admin:
```sql
UPDATE profiles SET role = 'admin' WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
```
3. [ ] Refresh the dashboard
4. [ ] Admin-only API endpoints now available at:
   - `POST /api/users` - Create new user
   - `GET /api/users` - List all users
   - `PATCH /api/users` - Update user role

## Deployment Preparation

### For Vercel Deployment:
1. [ ] Push repository to GitHub
2. [ ] Create new project in Vercel
3. [ ] Connect GitHub repository
4. [ ] Add all environment variables from `.env.local` to Vercel Settings
5. [ ] Deploy
6. [ ] In Supabase Auth settings, add your Vercel domain to **Redirect URLs**

### For Production:
- [ ] Plan for Redis-backed cache (optional, if scaling beyond single instance)
- [ ] Set up cron job to periodically call session cleanup function
- [ ] Configure email verification in Supabase Auth settings
- [ ] Set up audit log archival/retention policy

## Verification

- [ ] Build passes: `npm run build` (0 errors)
- [ ] Lint passes: `npm run lint` (0 errors)
- [ ] Can log in with Supabase credentials
- [ ] Can create subscriptions
- [ ] Dashboard displays subscriptions sorted by renewal date

## Troubleshooting

**Build Error: "Failed to write app endpoint"**
- Solution: Use `npm run build --webpack` instead

**"Unauthorized" error when creating subscription**
- Solution: Verify `.env.local` has correct keys and user is created in Supabase Auth

**Database connection errors**
- Solution: Check credentials are correct and Supabase project is active

**Cache not working**
- Solution: Verify `ENABLE_CACHE=true` in `.env.local`

## Next Steps

1. [ ] Customize subscription form fields if needed
2. [ ] Build admin dashboard for user management
3. [ ] Add analytics/charts to dashboard
4. [ ] Implement email reminders for renewals
5. [ ] Set up production deployment

## Support

Refer to:
- **README.md** - Full documentation
- **migrations/001_initial_schema.sql** - Database schema details
- **src/lib/** - Core utilities (auth, permissions, cache)
- **src/app/api/** - API endpoint implementations
