import { createClient } from '@/lib/supabase/client';

export interface PlatformPricing {
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  isCustom: boolean;
}

export interface FeaturedCharity {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  impactMetric: string;
  imageUrl?: string;
  websiteUrl?: string;
}

export interface PlatformStats {
  subscriberCount: number | null;
  charityCount: number | null;
  totalRaised: number | null;
  isZeroState: boolean;
}

export async function getPlatformSettings(): Promise<PlatformPricing> {
  const fallbackPricing: PlatformPricing = {
    monthlyPrice: 10,
    yearlyPrice: 99,
    currency: '£',
    isCustom: false,
  };

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return fallbackPricing;
    }

    return {
      monthlyPrice: Number(data.monthly_price ?? data.monthly_subscription_price ?? 10),
      yearlyPrice: Number(data.yearly_price ?? data.annual_subscription_price ?? 99),
      currency: data.currency || '£',
      isCustom: true,
    };
  } catch {
    return fallbackPricing;
  }
}

export async function getFeaturedCharity(): Promise<FeaturedCharity> {
  const fallbackCharity: FeaturedCharity = {
    id: 'hero-spotlight-1',
    name: "Hope Horizons Children's Foundation",
    tagline: 'Transforming pediatric healthcare & critical care access',
    description:
      'Providing life-saving medical equipment, compassionate family support, and specialized pediatric care for children facing severe illnesses across the country.',
    category: 'Children & Health',
    impactMetric:
      '100% of draw contributions directly fund life-saving hospital treatments and family assistance.',
    websiteUrl: 'https://example.org/hope-horizons',
  };

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('charities')
      .select('*')
      .eq('is_featured', true)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      const { data: firstData } = await supabase
        .from('charities')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (firstData) {
        return {
          id: firstData.id,
          name: firstData.name || fallbackCharity.name,
          tagline: firstData.tagline || fallbackCharity.tagline,
          description: firstData.description || fallbackCharity.description,
          category: firstData.category || fallbackCharity.category,
          impactMetric: firstData.impact_metric || fallbackCharity.impactMetric,
          imageUrl: firstData.image_url || firstData.logo_url,
          websiteUrl: firstData.website_url,
        };
      }
      return fallbackCharity;
    }

    return {
      id: data.id,
      name: data.name || fallbackCharity.name,
      tagline: data.tagline || fallbackCharity.tagline,
      description: data.description || fallbackCharity.description,
      category: data.category || fallbackCharity.category,
      impactMetric: data.impact_metric || fallbackCharity.impactMetric,
      imageUrl: data.image_url || data.logo_url,
      websiteUrl: data.website_url,
    };
  } catch {
    return fallbackCharity;
  }
}

export async function getPlatformStats(): Promise<PlatformStats> {
  try {
    const supabase = createClient();

    // 1. Call SQL function public.get_public_stats()
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_stats');

    if (!rpcError && rpcData) {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (row) {
        const activeSubscribers = Number(row.active_subscribers || 0);
        const activeCharities = Number(row.active_charities || 0);

        return {
          subscriberCount: activeSubscribers,
          charityCount: activeCharities,
          totalRaised: null,
          isZeroState: activeSubscribers === 0 && activeCharities === 0,
        };
      }
    }

    // 2. Direct count fallback if RPC not yet created in remote DB
    const { count: charityCount } = await supabase
      .from('charities')
      .select('*', { count: 'exact', head: true });

    const { count: subscriberCount } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true });

    const totalSubscribers = subscriberCount || 0;
    const totalCharities = charityCount || 0;

    return {
      subscriberCount: totalSubscribers,
      charityCount: totalCharities,
      totalRaised: null,
      isZeroState: totalSubscribers === 0 && totalCharities === 0,
    };
  } catch {
    return {
      subscriberCount: 0,
      charityCount: 0,
      totalRaised: null,
      isZeroState: true,
    };
  }
}
