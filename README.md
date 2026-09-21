# Digital Heroes (Charity Lottery & Golf Platform)

A Next.js 16 + Supabase + Stripe web platform combining monthly Stableford golf score tracking with charitable impact and verified prize draws.

---

## Charity & Contribution Architecture (Phase 4)

### 1. Contribution Calculation
- **Pure Calculation Logic**: Located in [`src/lib/charity/calculate.ts`](file:///src/lib/charity/calculate.ts).
- **Storage**: Contribution is calculated per payment and stored on the `payments` row (`charity_amount`).
- **Timing & Precedence**: Contribution percent changes take effect from the **next payment**; past payments preserve their historical splits.
- **Minimum Percent Enforced**: Minimum contribution is 10% (configured in `platform_settings.min_charity_percent`) and maximum is 100%. This is enforced on both client, server (Zod), and database trigger (`trigger_check_charity_percent` on `profiles`).

### 2. Independent Donations
- **Endpoint**: `POST /api/stripe/donate`
- **Checkout Mode**: Independent one-off payment via Stripe Checkout (`mode: 'payment'`).
- **Prize Pool Independence**: Direct donations go 100% to the chosen charity and are **strictly separate from the prize pool and monthly draw**. Donations do not impact draw entries, scoring, or prize calculations.
- **Idempotency**: Webhook `checkout.session.completed` uses `donations.stripe_payment_id` unique constraint to guarantee zero duplicate donation rows on webhook retries.
- **Membership Not Required**: Any guest or registered user can make a direct donation.

### 3. Charity Directory & Dynamic Profiles
- **Directory**: [`/charities`](file:///src/app/charities/page.tsx) with live search by name, category filters, "Featured" toggle, and shareable URL query parameters (`?category=...&q=...&featured=true`).
- **Charity Profile**: [`/charities/[slug]`](file:///src/app/charities/[slug]/page.tsx) featuring full mission descriptions, upcoming charity events & golf days (`charity_events`), verified totals from `get_charity_totals()`, and preset/custom donation options.

---

## Draw Engine, Prize Pool, Simulation & Publish (Phase 5)

### 1. Architectural Principles
- **No Tickets / No Assigned Numbers**: Users do not purchase tickets or receive generated numbers. The draw selects 5 winning numbers (1–45). Each eligible subscriber's 5 stored Stableford scores are matched against the winning numbers (3, 4, or 5 matches).
- **Matching Mechanism**: Set-based comparison (`countMatches`). Duplicate scores within a user's 5 rounds can only match a given winning number once.
- **Strict Eligibility**:
  - Requires a real active subscription row (`subscriptions.status = 'active'` and `current_period_end > now()`).
  - Exactly 5 scores (1–45) required.
  - Admin bypass does **NOT** grant draw eligibility. Admins without paid subscriptions are excluded.
- **Full Database Pagination**:
  - Subscriptions and scores are queried in 1,000-row pages using Supabase `.range()` to prevent truncation beyond Supabase's default 1,000-row limit.

### 2. Number Generation Modes
1. **True Random (`random`)**: Uniformly samples 5 distinct integers between 1 and 45.
2. **Frequency-Weighted Stableford Algorithm (`algorithm`)**:
   - Aggregates score distributions across all active member scores.
   - Every number 1–45 receives a base weight of 1, plus 1 for every occurrence in member scores.
   - 5 distinct numbers are selected without replacement using weighted probability.

### 3. Modeled Prize Pool & Integer Pence Arithmetic
All engine calculations are executed in integer pence to eliminate floating-point precision issues:
- **Pool Total**: 45% of total active member subscriptions:
  `Pool (pence) = Math.round( (monthly_count * monthly_price + yearly_count * (yearly_price / 12)) * 0.45 )`
- **Tier Splits**:
  - **Tier 5 (5 Matches / Jackpot)**: 40% of pool + any carried-in jackpot from previous draw.
  - **Tier 4 (4 Matches)**: 35% of pool (no rollover).
  - **Tier 3 (3 Matches)**: 25% of pool + penny rounding remainder (no rollover).
- **Exact Pool Sum**:
  Base tier pools sum **exactly** to the pool total (`tier5_base + tier4 + tier3 === pool_total`).
- **Leftover Pence from Uneven Splits**:
  - Prize per winner is computed via integer division: `Math.floor(tier_pool / winner_count)`.
  - Any leftover remainder pence stay **unallocated** and are retained in the platform prize reserve.
  - Tier pools and awarded amounts are strictly tracked in integer pence.
- **Rollover Rules**:
  - If Tier 5 has 0 winners, the entire Tier 5 pool (base 40% + carried-in jackpot) rolls over to the next published month's jackpot (`jackpot_rolled_over`).
  - Tiers 4 and 3 **never** roll over.
  - Carry-in jackpot comes **strictly** from the immediately previous published draw, and only if it rolled over.

### 4. Atomic Publish & Security Safeguards
- **Database Function**: `public.publish_draw(...)` executes in an atomic transaction.
- **Advisory Lock**: Uses `pg_advisory_xact_lock` keyed on the normalized month (`YYYY-MM-01`) to prevent concurrent race conditions.
- **Duplicate Prevention**: Checks inside the lock whether the month is already published. Re-publishing returns HTTP 409 Conflict.
- **Service-Role Isolation**: Execution permission for `publish_draw` is revoked from `PUBLIC, anon, authenticated` and granted exclusively to `service_role`.
- **Admin Verification**: Admin API routes identify callers via server session (`getUser()`), verify `profiles.role = 'admin'` from the database, and return 401 if unauthenticated or 403 if unauthorized.
- **Simulation Reuse**: Publishing accepts an optional `simulationId`, preserving previewed winning numbers and algorithm mode while recalculating pool and winners against live eligible subscribers at publish time.
- **Immutable Snapshots**: User scores are locked in `draw_entries.scores_snapshot`. Live score edits on the dashboard do not change historical draw entries.
- **Data Privacy**: `GET /api/draws/latest` returns only the authenticated caller's own entry and win record; other users' entries are never leaked.

### 5. Dev-Only Test Seed Script
To test the draw engine without manually setting up multiple accounts:
```bash
npm run seed:draw
# Or: npx tsx scripts/seed-test-draw-data.ts
```
- **Environment Protection**: Strictly refuses to execute when `NODE_ENV === 'production'`.
- Seeds 6 test subscribers with active subscriptions and 5 scores each:
  - `draw-subscriber-1@example.com` & `draw-subscriber-2@example.com`: Have **identical scores** (`[10, 20, 30, 40, 42]`) to test equal prize splitting.
  - `draw-subscriber-incomplete@example.com`: Has only 4 scores to verify eligibility rejection and dashboard messaging.

---

## Database Migrations

Run these migrations in order in the **Supabase SQL Editor**:
1. `supabase/migrations/001_initial_schema.sql` (Base tables, initial auth triggers)
2. `supabase/migrations/002_get_public_stats.sql` (Public aggregated stats function)
3. `supabase/migrations/003_align_schema.sql` (Aligned profiles, subscriptions, scores, charity events)
4. `supabase/migrations/004_drop_scores_policies.sql` (Score policy alignment)
5. `supabase/migrations/005_tighten_scores_rls.sql` (Strict database-level subscription RLS check for scores)
6. `supabase/migrations/006_charity_system.sql` (Charity categories, unique slugs, unique `stripe_payment_id`, `get_charity_totals()`, `check_charity_percent_min` trigger)
7. `supabase/migrations/007_draw_engine_and_publish.sql` (Draw engine schema, unique published month index, atomic `publish_draw` with advisory lock and service-role privilege, charity events date refresh)

---

## Testing Independent Donations with the Stripe CLI

### 1. Forward Webhooks Locally
Start the Stripe CLI listener forwarding to your local Next.js instance:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Copy the webhook signing secret output by the command (`whsec_...`) into your `.env.local`:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Make a Test Donation
1. Visit a charity profile page (e.g. `http://localhost:3000/charities/hope-horizons`).
2. Select an amount (e.g. £5 or £25) and click **"Donate"**.
3. On the Stripe Checkout page, use standard test card `4242 4242 4242 4242` with any future expiry and 3-digit CVC.
4. Complete checkout. You will be redirected to `/donate/success?charity=hope-horizons`.

### 3. Test Webhook Idempotency
To verify duplicate webhook delivery does not insert duplicate records:
```bash
stripe events resend <evt_id_from_listen_log>
```
Check the `donations` table in Supabase — exactly one row exists for that `stripe_payment_id`.

---

## Test Checklist

| Test | Action | Expected Result |
| :--- | :--- | :--- |
| **Search & Filter** | Search "health" or select "Environment" on `/charities` | Directory updates instantly and updates the URL query string (`/charities?category=...&q=...`). |
| **Charity Profile** | Open `/charities/hope-horizons` | Shows charity mission, upcoming golf days/events, and total raised. |
| **Below Min Percent** | Try setting percent to `5%` via API or form | Rejected with error (minimum 10%). |
| **Raise Percent** | Set percent to `25%` on `/dashboard` | Saved to `profiles`, and dashboard card updates to show £2.50/mo. |
| **Next Payment Notice** | Update charity / percent on dashboard | Note displayed: "Changes apply from your next subscription payment." |
| **Independent Donation** | Donate £5 via `/charities/[slug]` with card 4242... | Successfully completes, inserts one row in `donations`, does not touch subscriptions. |
| **Webhook Idempotency** | Resend donation `checkout.session.completed` event | No duplicate row inserted (`ON CONFLICT (stripe_payment_id) DO NOTHING`). |
| **Guest Donation** | Donate while logged out | Works seamlessly without subscription requirement. |
| **Subscription Safety** | Purchase a subscription | Phase 2 checkout and webhook continue to activate subscription normally. |
| **6-Score Cap** | Add a 6th golf score on `/dashboard` | Database trigger keeps exactly the latest 5 scores. |
