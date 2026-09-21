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

## Database Migrations

Run these migrations in order in the **Supabase SQL Editor**:
1. `supabase/migrations/001_initial_schema.sql` (Base tables, initial auth triggers)
2. `supabase/migrations/002_get_public_stats.sql` (Public aggregated stats function)
3. `supabase/migrations/003_align_schema.sql` (Aligned profiles, subscriptions, scores, charity events)
4. `supabase/migrations/004_drop_scores_policies.sql` (Score policy alignment)
5. `supabase/migrations/005_tighten_scores_rls.sql` (Strict database-level subscription RLS check for scores)
6. `supabase/migrations/006_charity_system.sql` (Charity categories, unique slugs, unique `stripe_payment_id`, `get_charity_totals()` function, `check_charity_percent_min` trigger, and updated `handle_new_user`)

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
