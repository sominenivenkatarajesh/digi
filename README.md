# Digital Heroes — Charity Golf Lottery Platform

Digital Heroes is a full-stack web application combining monthly Stableford golf score tracking with charitable impact and verified prize draws. Built with Next.js 16 (App Router), Supabase (PostgreSQL + RLS + Storage), and Stripe (Subscriptions, One-Off Donations, Customer Portal).

---

## 1. Project Overview & Architecture

### Tech Stack
- **Framework**: Next.js 16.3.5 (App Router, Server Components & Route Handlers)
- **Database & Auth**: Supabase PostgreSQL 15 with Row-Level Security (RLS) policies, triggers, and column-level privilege controls
- **Object Storage**: Supabase Storage (`winner-proofs` private bucket)
- **Payments**: Stripe Billing (Monthly & Yearly subscriptions, Customer Portal, One-Off Direct Charity Donations, Webhooks)
- **Styling**: Tailwind CSS with custom Glassmorphism & Gold/Emerald design tokens
- **Testing**: Vitest (Unit and integration test suites)
- **Language**: TypeScript (Strict mode enabled)

### Core User Journey
1. **User Authentication & Subscription**: Sign up, choose a Monthly (£10/mo) or Annual (£99/yr) plan via Stripe Checkout.
2. **Score Entry**: Record up to 5 verified Stableford golf scores (1–45). A rolling 5-score FIFO rule automatically archives older rounds.
3. **Charity Selection**: Allocate 10%–100% of subscription fees to any partner charity, or make direct independent donations.
4. **Monthly Prize Draws**: Transparent, verifiable draw engine selecting 5 winning numbers (1–45) using true random or frequency-weighted algorithms. Set-based matching awards prizes across Tiers 3, 4, and 5.
5. **Winner Verification & Payouts**: Winners upload proof screenshots. Admins review submissions and track payouts.
6. **Admin Panel**: Full control across 6 dedicated sections (Overview, User Management, Draw Engine, Charities, Winner Verification, Financial Reports).

---

## 2. Setup Instructions from a Clean Clone

### Prerequisites
- Node.js 18.x or 20.x
- A Supabase project (New project for production evaluation)
- A Stripe account in Test Mode (New account/keys for production evaluation)

### Step 1: Clone and Install Dependencies
```bash
git clone <repository-url>
cd digi
npm install
```

### Step 2: Environment Configuration
Create a `.env.local` file in the root directory (based on `.env.example`):
```env
# Next.js App
NEXT_PUBLIC_SITE_URL=https://your-deployment-domain.vercel.app

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...   # £10.00 / month recurring
STRIPE_YEARLY_PRICE_ID=price_...    # £99.00 / year recurring
```

### Step 3: Run Database Migrations in Order
In your **Supabase Project SQL Editor**, execute the migration files strictly in the following sequential order:
1. `supabase/migrations/001_initial_schema.sql` — Base tables (`profiles`, `subscriptions`, `scores`, `draws`, `charities`), RLS, auth user trigger.
2. `supabase/migrations/002_get_public_stats.sql` — Public aggregated statistics RPC.
3. `supabase/migrations/003_align_schema.sql` — Profiles, subscriptions, scores, charity events schema alignment and storage bucket definition.
4. `supabase/migrations/004_subscriptions_unique_user.sql` — Unique constraint on `subscriptions.user_id` for safe idempotent upserts and resubscription synchronization.
5. `supabase/migrations/005_tighten_scores_rls.sql` — Strict database-level subscription RLS check for scores.
6. `supabase/migrations/006_charity_system.sql` — Charity categories, unique slugs, unique `stripe_payment_id`, `get_charity_totals()`, and `check_charity_percent_min` trigger.
7. `supabase/migrations/007_draw_engine_and_publish.sql` — Draw engine schema (`draw_entries`, `winners`), unique published month index, atomic `publish_draw` with `pg_advisory_xact_lock` and service-role privilege.
8. `supabase/migrations/008_winner_verification_and_payouts.sql` — Winner verification schema, column-level `REVOKE/GRANT`, `protect_winner_critical_fields` trigger, and private storage policies for `winner-proofs`.
9. `supabase/migrations/009_admin_dashboard_and_reports.sql` — Admin subscription override audit fields, `profiles.role` protection trigger, single-featured charity trigger, and `get_admin_reports()` aggregate RPC.

### Step 4: Seed Initial Data
Execute the seed SQL in the Supabase SQL Editor:
- The base migration files already include initial seed charities (e.g., Hope Horizons Children's Foundation, GreenFairways Junior Golf Trust, Fairway Veterans Golf Alliance).
- To seed sample charity events or initial public stats, verify that rows exist in `charities` and `charity_events`.

### Step 5: Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Live Deployment & Evaluator Credentials

### Live Production Deployment
- **Production URL**: `https://digi-omega.vercel.app` *(or custom domain assigned)*
- **Supabase Project**: Production database running PostgreSQL 15 with RLS enabled across all tables.

### Evaluator Test Credentials

#### 1. Test Subscriber Account (Pre-populated)
*Configured with an active subscription, 5 Stableford scores, and at least one historical winner row:*
- **Email**: `subscriber@digitalheroes.example`
- **Password**: `DigitalHeroes2026!`
- **State**:
  - Subscription: Active (£10/month)
  - Scores: 5 verified scores recorded (`[36, 38, 40, 34, 42]`)
  - Winnings: Contains 1 pending verification winner row from a previous draw so verification/payout can be tested immediately without setup.

#### 2. Test Admin Account
*Configured with full administrative access (`profiles.role = 'admin'`):*
- **Email**: `admin@digitalheroes.example`
- **Password**: `AdminHeroes2026!`
- **Access**: Full access to all 6 admin sections under `/admin` (`/admin`, `/admin/users`, `/admin/draws`, `/admin/charities`, `/admin/winners`, `/admin/reports`).

---

## 4. Consolidated System Assumptions & Architecture Rules

Every documented platform assumption and architectural rule is consolidated below:

### 1. Draw Eligibility Rules
- **Active Subscription Required**: An account must have a row in `subscriptions` with `status = 'active'` and `current_period_end > now()`.
- **Exactly 5 Scores Required**: A user must have exactly 5 scores recorded between 1 and 45. Incomplete score profiles (0–4 scores) are ineligible.
- **Admin Privilege Bypass Rule**: Admins do **NOT** receive automatic draw eligibility. Platform admins without paid subscriptions and 5 scores are excluded from draws.
- **Database Pagination**: All engine subscriber and score queries use 1,000-row pagination chunks (`.range()`) to prevent truncation beyond default Supabase limits.

### 2. Draw Simulation, Number Generation & Rollover
- **No Tickets / No Picked Numbers**: Members do not pick lottery numbers or purchase tickets. The draw engine picks 5 winning numbers (1–45). The member's 5 Stableford scores are matched against the winning numbers.
- **Set-Based Matching**: Matches are counted using set intersection (`countMatches`). Duplicate scores within a user's 5 rounds can only match a winning number once.
- **Number Generation Modes**:
  1. *True Random (`random`)*: Uniform random sampling of 5 distinct numbers from 1–45.
  2. *Frequency-Weighted Algorithm (`algorithm`)*: Aggregates member scores. Each number 1–45 receives a base weight of 1, plus 1 for each time it appears in member scores. 5 distinct numbers are selected via weighted sampling without replacement.
- **Atomic Publish**: Draws publish inside an atomic PostgreSQL function `publish_draw` using `pg_advisory_xact_lock` on the normalized month (`YYYY-MM-01`). Duplicate publishes for the same month return HTTP 409 Conflict.
- **Immutable Snapshots**: Winning entries lock user scores in `draw_entries.scores_snapshot`. Live edits on `/dashboard` never alter historical draw records.

### 3. Prize Pool Allocation & Integer Pence Arithmetic
All prize pool mathematics are calculated strictly in **integer pence**:
- **Total Prize Pool**: 45% of total active member contributions:
  $$\text{Pool (pence)} = \text{round}\Big(\big(\text{monthly\_count} \times 1000 + \text{yearly\_count} \times \frac{9900}{12}\big) \times 0.45\Big)$$
- **Tier Allocations**:
  - **Tier 5 (5 Matches / Jackpot)**: 40% of pool + carry-in jackpot from the previous month.
  - **Tier 4 (4 Matches)**: 35% of pool (never rolls over).
  - **Tier 3 (3 Matches)**: 25% of pool + rounding difference (never rolls over).
  - Base tier pools sum **exactly** to the pool total: $\text{Tier5}_{\text{base}} + \text{Tier4} + \text{Tier3} \equiv \text{Pool}_{\text{total}}$.
- **Integer Division & Leftover Pence**:
  - Individual winner payout: $\lfloor \frac{\text{tier\_pool}}{\text{winner\_count}} \rfloor$.
  - Any leftover remainder pence from uneven divisions are retained in the platform prize reserve.
- **Rollover Rule**:
  - If Tier 5 has 0 winners, the entire Tier 5 pool (base 40% + carry-in) rolls over to next month's jackpot (`jackpot_rolled_over`).
  - Tiers 4 and 3 never roll over.
  - Carry-in jackpot originates strictly from the immediately preceding published draw if it rolled over.

### 4. Charity Contribution & Direct Donations
- **Subscription Splits**: Minimum 10% (enforced by DB trigger `check_charity_percent_min`), maximum 100%. Changes take effect from the **next payment**; historical payment records retain their original split.
- **Direct Donations**: 100% goes directly to the chosen charity. Direct donations are strictly separate from the prize pool and monthly draw.
- **Webhook Idempotency**: Handled via PostgreSQL unique constraint on `donations.stripe_payment_id`. Webhook retries are safe and produce no duplicate records.

### 5. Winner Verification & Security Safeguards
- **Screenshot / Image Only Restriction**: Winner verification strictly accepts image formats only (**PNG, JPEG, WebP**). PDFs, executables, HTML scripts, and disguised text files are explicitly rejected by magic-byte content inspection and immediately deleted from storage if uploaded.
- **Column-Level Permissions**: Authenticated users have `UPDATE` revoked on `public.winners`, granted only for `proof_url`.
- **Database Trigger Guard**: `protect_winner_critical_fields()` trigger explicitly blocks updates to `prize_amount, tier, payment_status, draw_id, user_id, verification_status, reviewed_by, reviewed_at, rejection_reason, admin_note, paid_at` by non-service-role clients.

### 6. Stripe Webhook Architecture & Event Registration
When configuring the production webhook endpoint in the Stripe Dashboard (`/api/stripe/webhook`), register **strictly the following 6 events**:
1. `checkout.session.completed` — Initial subscription activation and one-off direct charity donations.
2. `customer.subscription.created` — Initial subscription record synchronization.
3. `customer.subscription.updated` — Renewal periods, cancellations at period end, and plan changes.
4. `customer.subscription.deleted` — Subscription cancellation / termination.
5. `invoice.paid` — Successful renewal processing, 45% prize pool & 10%+ charity payment tracking, subscription activation.
6. `invoice.payment_failed` — Failed renewal charges; immediately transitions status to `lapsed`.

### 7. Admin Overrides & Role Protection
- **Role Tampering Guard**: `profiles.role` updates are revoked from `authenticated` users, and guarded by `protect_profile_role()` trigger. Non-admin users cannot escalate their role.
- **Subscription Override Audit**: Admin manual status overrides require an audit note (`admin_override_note`), recording who (`admin_overridden_by`) and when (`admin_overridden_at`).
- **Stripe Precedence Warning**: The admin UI clearly displays: *"This is temporary and will be overwritten by the next Stripe event."* The override audit note persists on `/admin/users/[id]` even after a subsequent webhook changes the subscription status.
- **Single Featured Charity**: DB trigger `maintain_single_featured_charity()` ensures only one charity is featured at a time without infinite recursion.

---

## 5. Known Limitations (Out of Scope)

The following items are intentional architectural boundaries:
1. **Reactivate-Before-Period-End in Portal**: When a user cancels a subscription in Stripe Test Mode, the Stripe billing portal does not provide an immediate one-click "Reactivate" button prior to period end without creating a new session. Users can renew upon billing period expiration.
2. **Charity Deactivation vs. Hard Deletion**: Partner charities cannot be hard-deleted if foreign key references exist in `donations` or `profiles`. They are soft-deactivated (`is_active = false`), which removes them from public directories and returns 404 on slug lookups while preserving historical financial integrity.
3. **Stripe Test Mode Zero-Pence Invoices**: Setup invoices or trial events with 0 amount are skipped by the webhook handler to prevent zero-value payment records.

---

## 6. How to Test Payments & the Draw Engine

### Testing Payments with Stripe Test Cards
Use Stripe's standard test payment cards:
- **Successful Subscription / Donation**: `4242 4242 4242 4242`, any future expiry date (e.g., `12/28`), any 3-digit CVC (`123`), any postal code.
- **3D Secure Authentication**: `4000 0027 6000 3184` (Triggers Stripe 3DS modal challenge).
- **Declined Card**: `4000 0002 0111 0993` (Simulates card declined error banner).

### Testing the Draw Engine Locally or in Staging
1. Log in as an Administrator (`admin@digitalheroes.example`).
2. Navigate to `/admin/draws`.
3. In the **Simulate & Publish Draw** console:
   - Select the target draw month (defaults to current month `YYYY-MM`).
   - Select the Mode: **True Random** or **Frequency-Weighted Algorithm**.
   - Click **Run Simulation**: The engine previews the 5 winning numbers, calculates the eligible prize pool (45% of active subscribers), checks previous jackpot rollovers, and lists all matching winners across Tiers 5, 4, and 3.
   - Click **Publish Official Draw**: Publishes the draw atomically with database advisory locks, records immutable score snapshots, creates winner rows, and exposes results on `/dashboard` and `/admin/winners`.

---

## 7. Verification & Automated Test Suite

To run the complete automated test suite:
```bash
npm test
```

### Test Suite Coverage (87/87 Passing)
- `src/lib/charity/__tests__/donations.test.ts` (8 tests) — Idempotency, direct donation splitting.
- `src/lib/charity/__tests__/calculate.test.ts` (9 tests) — 10%–100% calculation and rounding.
- `src/lib/scores/__tests__/logic.test.ts` (16 tests) — 5-score FIFO rolling rules, score validation (1–45).
- `src/lib/engine/__tests__/engine.test.ts` (21 tests) — Integer pence arithmetic, rollover rules, weighted algorithm.
- `src/lib/winners/__tests__/winners.test.ts` (21 tests) — Magic byte verification, column-level security.
- `src/lib/admin/__tests__/admin.test.ts` (12 tests) — User pagination, audit override tracking, single-featured charity logic.

Production build verification:
```bash
npm run build
```
Result: All 23 static and dynamic routes compiled successfully with 0 errors.
