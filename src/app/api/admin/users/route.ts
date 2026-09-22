import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCaller } from '@/lib/engine/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 20;

/**
 * GET /api/admin/users
 * Admin endpoint to list and search all platform users with pagination.
 *
 * Requirements:
 * - Admin authorization enforced via session -> profiles.role check in database.
 * - Uses service-role client to join profiles, subscriptions, charities, and auth email.
 * - Does not expose emails through any non-admin route.
 * - Default page size is 20.
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminCaller();
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10));
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const status = searchParams.get('status')?.trim().toLowerCase() || 'all';

    const adminClient = createAdminClient();

    // Fetch auth users to get emails reliably
    const { data: authUsersData } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });
    const authUsers = authUsersData?.users || [];
    const emailMap = new Map<string, string>();
    authUsers.forEach((u) => {
      if (u.email) {
        emailMap.set(u.id, u.email);
      }
    });

    // Query profiles with subscriptions and charities
    let query = adminClient
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        role,
        charity_id,
        charity_percent,
        created_at,
        charities (
          id,
          name,
          slug,
          is_active
        ),
        subscriptions (
          plan,
          status,
          current_period_end,
          cancel_at_period_end,
          admin_override_note,
          admin_overridden_at
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Execute query
    const { data: profiles, error: queryError, count } = await query;

    if (queryError) {
      console.error('Error fetching admin users:', queryError);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    // Combine profile data with verified auth email
    let combinedUsers = (profiles || []).map((p: any) => {
      const email = emailMap.get(p.id) || p.email || 'No email';
      const sub = Array.isArray(p.subscriptions) ? p.subscriptions[0] : p.subscriptions;
      const charity = Array.isArray(p.charities) ? p.charities[0] : p.charities;

      return {
        id: p.id,
        email,
        full_name: p.full_name || 'Anonymous User',
        role: p.role || 'subscriber',
        created_at: p.created_at,
        charity_percent: Number(p.charity_percent || 10),
        charity: charity ? { id: charity.id, name: charity.name, is_active: charity.is_active } : null,
        subscription: sub ? {
          plan: sub.plan || 'monthly',
          status: sub.status || 'inactive',
          current_period_end: sub.current_period_end,
          cancel_at_period_end: Boolean(sub.cancel_at_period_end),
          admin_override_note: sub.admin_override_note || null,
          admin_overridden_at: sub.admin_overridden_at || null,
        } : {
          plan: 'monthly',
          status: 'inactive',
          current_period_end: null,
          cancel_at_period_end: false,
          admin_override_note: null,
          admin_overridden_at: null,
        },
      };
    });

    // Filter by search (name or email)
    if (search) {
      combinedUsers = combinedUsers.filter(
        (u) =>
          u.full_name.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          u.id.toLowerCase().includes(search)
      );
    }

    // Filter by subscription status
    if (status && status !== 'all') {
      combinedUsers = combinedUsers.filter((u) => u.subscription.status === status);
    }

    const totalFiltered = combinedUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const offset = (page - 1) * pageSize;
    const paginatedUsers = combinedUsers.slice(offset, offset + pageSize);

    return NextResponse.json({
      users: paginatedUsers,
      pagination: {
        page,
        pageSize,
        total: totalFiltered,
        totalPages,
      },
    });
  } catch (err: unknown) {
    console.error('Error in GET /api/admin/users:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
