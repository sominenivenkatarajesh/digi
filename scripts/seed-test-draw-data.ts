import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Enforce strict non-production environment guard
if (process.env.NODE_ENV === 'production') {
  console.error('\n❌ ERROR: scripts/seed-test-draw-data.ts cannot and will not run in PRODUCTION environments.');
  console.error('This script is strictly for local development and testing only.\n');
  process.exit(1);
}

// 2. Load environment variables from .env.local if not already in process.env
function loadLocalEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
}
loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('\n❌ Missing Supabase service credentials.');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined in .env.local\n');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Test users definition
// Notice: User 1 and User 2 have IDENTICAL scores [10, 20, 30, 40, 42] to test equal tier prize splits!
// Notice: User 7 has exactly 4 scores to verify eligibility exclusion and dashboard messaging.
const TEST_USERS = [
  {
    email: 'draw-subscriber-1@example.com',
    password: 'TestPassword123!',
    fullName: 'Alice Walker (Identical Set A)',
    plan: 'monthly',
    scores: [10, 20, 30, 40, 42],
  },
  {
    email: 'draw-subscriber-2@example.com',
    password: 'TestPassword123!',
    fullName: 'Bob Davis (Identical Set A)',
    plan: 'monthly',
    scores: [10, 20, 30, 40, 42],
  },
  {
    email: 'draw-subscriber-3@example.com',
    password: 'TestPassword123!',
    fullName: 'Charlie Evans (Annual Plan)',
    plan: 'yearly',
    scores: [5, 15, 25, 35, 45],
  },
  {
    email: 'draw-subscriber-4@example.com',
    password: 'TestPassword123!',
    fullName: 'Diana Prince (Partial Matcher)',
    plan: 'monthly',
    scores: [1, 10, 20, 30, 33],
  },
  {
    email: 'draw-subscriber-5@example.com',
    password: 'TestPassword123!',
    fullName: 'Edward Stone (High Spread)',
    plan: 'monthly',
    scores: [7, 14, 21, 28, 35],
  },
  {
    email: 'draw-subscriber-6@example.com',
    password: 'TestPassword123!',
    fullName: 'Fiona Gallagher (Tier 4 Candidate)',
    plan: 'yearly',
    scores: [4, 10, 20, 30, 40],
  },
  {
    email: 'draw-subscriber-incomplete@example.com',
    password: 'TestPassword123!',
    fullName: 'George Incomplete (Only 4 Scores)',
    plan: 'monthly',
    scores: [10, 20, 30, 40], // Only 4 scores -> Must be excluded by isEligible!
  },
];

async function seedTestDrawData() {
  console.log('\n======================================================');
  console.log('🌱 Digital Heroes — Dev Draw Data Seeder');
  console.log('======================================================\n');
  console.log(`Connecting to: ${supabaseUrl}`);

  // Fetch a valid charity to assign
  const { data: defaultCharity } = await adminSupabase
    .from('charities')
    .select('id, name')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const charityId = defaultCharity?.id || null;
  console.log(`Using default active charity: ${defaultCharity?.name || 'None'}`);

  let createdCount = 0;

  for (const userDef of TEST_USERS) {
    console.log(`\nProcessing user: ${userDef.email}...`);

    let userId: string;

    // Check if auth user already exists
    const { data: listData } = await adminSupabase.auth.admin.listUsers();
    const existing = listData?.users?.find((u) => u.email === userDef.email);

    if (existing) {
      userId = existing.id;
      console.log(`  ✓ Auth user exists: ${userId}`);
    } else {
      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email: userDef.email,
        password: userDef.password,
        email_confirm: true,
        user_metadata: { full_name: userDef.fullName },
      });

      if (createError || !newUser?.user) {
        console.error(`  ❌ Failed to create auth user ${userDef.email}:`, createError);
        continue;
      }
      userId = newUser.user.id;
      console.log(`  ✓ Created new auth user: ${userId}`);
    }

    // Upsert Profile
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: userDef.email,
          full_name: userDef.fullName,
          role: 'member',
          charity_id: charityId,
          charity_percent: 10,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      console.error(`  ❌ Failed to upsert profile:`, profileError);
      continue;
    }

    // Upsert Active Subscription Row
    const futurePeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: subError } = await adminSupabase
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan: userDef.plan,
          status: 'active',
          current_period_end: futurePeriodEnd,
          cancel_at_period_end: false,
        },
        { onConflict: 'user_id' }
      );

    if (subError) {
      console.error(`  ❌ Failed to upsert subscription:`, subError);
      continue;
    }
    console.log(`  ✓ Active ${userDef.plan} subscription verified (valid until ${futurePeriodEnd.slice(0, 10)})`);

    // Reset and Insert Test Scores
    await adminSupabase.from('scores').delete().eq('user_id', userId);

    const scoresToInsert = userDef.scores.map((score, index) => ({
      user_id: userId,
      score,
      played_on: new Date(Date.now() - (index + 1) * 86400000).toISOString().slice(0, 10),
    }));

    const { error: scoreError } = await adminSupabase.from('scores').insert(scoresToInsert);
    if (scoreError) {
      console.error(`  ❌ Failed to insert scores:`, scoreError);
      continue;
    }

    console.log(`  ✓ Inserted ${userDef.scores.length} scores: [${userDef.scores.join(', ')}]`);
    createdCount++;
  }

  console.log('\n======================================================');
  console.log(`✅ Seed Complete: Successfully seeded ${createdCount}/${TEST_USERS.length} test accounts.`);
  console.log('Notes:');
  console.log(' - User 1 and User 2 have IDENTICAL scores: [10, 20, 30, 40, 42]');
  console.log(' - User 7 has only 4 scores (excluded from draw for testing)');
  console.log(' - You can now open /admin/draws and run a simulation preview!');
  console.log('======================================================\n');
}

seedTestDrawData().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
