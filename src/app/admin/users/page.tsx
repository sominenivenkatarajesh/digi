'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

interface AdminUserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  charity_percent: number;
  charity: {
    id: string;
    name: string;
    is_active: boolean;
  } | null;
  subscription: {
    plan: 'monthly' | 'yearly';
    status: 'active' | 'inactive' | 'lapsed' | 'cancelled';
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    admin_override_note: string | null;
    admin_overridden_at: string | null;
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'lapsed' | 'cancelled'>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const loadUsers = async () => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '20');
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setPagination(data.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Error loading admin users:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  return (
    <Container size="wide" className="pt-8 pb-16">
      {/* Title & Actions */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-white flex items-center gap-2.5">
            Member Management
            <span className="text-xs font-mono font-normal uppercase px-2.5 py-0.5 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/30">
              {pagination.total} Registered
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Search registered users, audit subscriptions, view Stableford scores, and perform support overrides.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadUsers}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh Users
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50"
          />
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(['all', 'active', 'inactive', 'lapsed', 'cancelled'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStatusFilter(tab);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-gold-500/20 text-gold-300 border border-gold-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Users Responsive Layout: Stacked Cards (<768px) & Table (>=768px) */}
      {isLoading ? (
        <GlassCard className="p-12 text-center">
          <div className="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading members list...</p>
        </GlassCard>
      ) : users.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Users className="w-10 h-10 text-slate-500 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-bold text-white mb-1">No members found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all'
              ? 'No users match your search and filter criteria.'
              : 'No registered user accounts found in the database.'}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {/* Mobile Stacked Cards (< 768px) */}
          <div className="md:hidden space-y-3">
            {users.map((u) => (
              <GlassCard key={u.id} className="p-4 border-white/10 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate flex items-center gap-1.5 text-sm">
                      {u.full_name}
                      {u.role === 'admin' && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-slate-400 truncate">{u.email}</div>
                  </div>
                  <StatusBadge status={u.subscription.status} size="xs" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Charity</span>
                    <span className="text-slate-300 truncate block font-medium">
                      {u.charity ? u.charity.name : 'None selected'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Joined</span>
                    <span className="text-slate-300 font-mono text-[11px]">
                      {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {u.subscription.admin_override_note && (
                  <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[11px] flex items-center gap-1.5">
                    <StatusBadge status="override" size="xs" label="Override Active" />
                    <span className="truncate">Note: {u.subscription.admin_override_note}</span>
                  </div>
                )}

                <Link href={`/admin/users/${u.id}`} className="block pt-1">
                  <Button variant="secondary" size="sm" className="w-full justify-center text-xs">
                    Manage Member →
                  </Button>
                </Link>
              </GlassCard>
            ))}
          </div>

          {/* Desktop Table with Horizontal Scroll Hint (>= 768px) */}
          <GlassCard className="hidden md:block overflow-hidden border border-white/10 relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-950/80 border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Member</th>
                    <th className="px-5 py-3.5">Subscription</th>
                    <th className="px-5 py-3.5">Supported Charity</th>
                    <th className="px-5 py-3.5">Joined Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-navy-900 border border-white/10 flex items-center justify-center text-slate-300 font-bold shrink-0">
                            {u.full_name ? u.full_name[0]?.toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate flex items-center gap-1.5">
                              {u.full_name}
                              {u.role === 'admin' && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400 truncate">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <StatusBadge status={u.subscription.status} size="xs" />
                          <span className="text-[11px] text-slate-400 font-mono ml-1.5 capitalize">
                            ({u.subscription.plan})
                          </span>

                          {u.subscription.admin_override_note && (
                            <div className="pt-0.5">
                              <StatusBadge status="override" size="xs" label="Override Active" />
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {u.charity ? (
                          <div>
                            <span className="font-medium text-white block truncate max-w-xs">
                              {u.charity.name}
                            </span>
                            <span className="text-[11px] font-mono text-emerald-400">
                              {u.charity_percent}% contribution
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">None selected</span>
                        )}
                      </td>

                      <td className="px-5 py-4 font-mono text-[11px] text-slate-400">
                        {new Date(u.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link href={`/admin/users/${u.id}`}>
                          <Button variant="secondary" size="sm" className="text-xs">
                            Manage User →
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing {(page - 1) * pagination.pageSize + 1} to{' '}
                {Math.min(page * pagination.pageSize, pagination.total)} of {pagination.total} users
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Previous
                </Button>
                <span className="font-mono text-white px-2">
                  {page} / {pagination.totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </GlassCard>
        </div>
      )}
    </Container>
  );
}
