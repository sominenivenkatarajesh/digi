import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AdminAuthResult {
  authorized: boolean;
  userId?: string;
  response?: NextResponse;
}

/**
 * Validates that the HTTP request caller is authenticated and has the 'admin' role.
 *
 * Security Protocol:
 * 1. Read caller session from cookie/server client (getUser()).
 * 2. If no session, return 401 Unauthorized.
 * 3. Query profiles.role for this caller.
 * 4. If role !== 'admin', return 403 Forbidden.
 */
export async function verifyAdminCaller(): Promise<AdminAuthResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Authentication required. No active session.' },
          { status: 401 }
        ),
      };
    }

    const adminClient = createAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== 'admin') {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Access forbidden. Administrator privileges required.' },
          { status: 403 }
        ),
      };
    }

    return {
      authorized: true,
      userId: user.id,
    };
  } catch (err) {
    console.error('Error in verifyAdminCaller:', err);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Internal server error during authorization check.' },
        { status: 500 }
      ),
    };
  }
}
