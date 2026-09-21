import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CharityProfileClient, CharityData, CharityEvent } from './CharityProfileClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  // Query strictly by slug and ensure charity is active (no UUID fallback for inactive)
  const { data: charity } = await supabase
    .from('charities')
    .select('name, tagline, description, short_description')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!charity) {
    return {
      title: 'Charity Not Found | Digital Heroes',
    };
  }

  return {
    title: `${charity.name} | Digital Heroes`,
    description: charity.short_description || charity.tagline || charity.description?.slice(0, 160),
  };
}

export default async function CharityProfilePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const initialDonate = resolvedSearchParams?.donate === 'true';

  const supabase = await createClient();

  // 1. Fetch charity strictly by slug and require is_active = true (Inactive charities return 404)
  const { data: charity, error: charityError } = await supabase
    .from('charities')
    .select('id, name, slug, tagline, description, short_description, category, impact_metric, website_url, logo_url, image_url, is_featured, is_active')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (charityError || !charity) {
    notFound();
  }

  // 2. Fetch real charity totals via get_charity_totals()
  let totalRaised = 0;
  const { data: totalsData } = await supabase.rpc('get_charity_totals');
  if (totalsData && Array.isArray(totalsData)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = totalsData.find((item: any) => item.charity_id === charity.id);
    if (row && row.total_raised) {
      totalRaised = Number(row.total_raised);
    }
  }

  // 3. Fetch upcoming charity events (event_date >= today, ascending)
  const todayIso = new Date().toISOString();
  const { data: eventsData } = await supabase
    .from('charity_events')
    .select('id, charity_id, title, event_date, location, description')
    .eq('charity_id', charity.id)
    .gte('event_date', todayIso)
    .order('event_date', { ascending: true });

  const events: CharityEvent[] = (eventsData || []).map((evt: any) => ({
    id: evt.id,
    charity_id: evt.charity_id,
    title: evt.title,
    event_date: evt.event_date,
    location: evt.location,
    description: evt.description,
  }));

  // 4. Check user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <CharityProfileClient
      charity={charity as CharityData}
      totalRaised={totalRaised}
      events={events}
      isLoggedIn={Boolean(user)}
      initialDonate={initialDonate}
    />
  );
}
