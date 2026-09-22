'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Heart,
  Plus,
  Edit2,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  Trash2,
  Eye,
  Check,
  Ban,
  RefreshCw,
} from 'lucide-react';

interface CharityItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  tagline: string | null;
  description: string;
  short_description: string | null;
  image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  event_count?: number;
}

interface CharityEvent {
  id: string;
  charity_id: string;
  title: string;
  event_date: string;
  location: string | null;
  description: string | null;
}

export default function AdminCharitiesPage() {
  const [charities, setCharities] = useState<CharityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Charity Modal State (Add / Edit)
  const [isCharityModalOpen, setIsCharityModalOpen] = useState(false);
  const [editingCharity, setEditingCharity] = useState<CharityItem | null>(null);
  const [charityForm, setCharityForm] = useState({
    name: '',
    slug: '',
    category: 'Children & Healthcare',
    tagline: '',
    short_description: '',
    description: '',
    image_url: '',
    is_featured: false,
    is_active: true,
  });
  const [charityError, setCharityError] = useState<string | null>(null);
  const [isSavingCharity, setIsSavingCharity] = useState(false);

  // Event Management Modal State
  const [selectedCharityForEvents, setSelectedCharityForEvents] = useState<CharityItem | null>(null);
  const [events, setEvents] = useState<CharityEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventForm, setEventForm] = useState({
    id: '',
    title: '',
    event_date: '',
    location: '',
    description: '',
  });
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  const loadCharities = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/charities');
      if (res.ok) {
        const data = await res.json();
        setCharities(data.charities || []);
      }
    } catch (err) {
      console.error('Error fetching admin charities:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCharities();
  }, []);

  // Open Add Charity Modal
  const handleOpenAddCharity = () => {
    setEditingCharity(null);
    setCharityForm({
      name: '',
      slug: '',
      category: 'Community',
      tagline: '',
      short_description: '',
      description: '',
      image_url: '',
      is_featured: false,
      is_active: true,
    });
    setCharityError(null);
    setIsCharityModalOpen(true);
  };

  // Open Edit Charity Modal
  const handleOpenEditCharity = (c: CharityItem) => {
    setEditingCharity(c);
    setCharityForm({
      name: c.name,
      slug: c.slug,
      category: c.category,
      tagline: c.tagline || '',
      short_description: c.short_description || '',
      description: c.description,
      image_url: c.image_url || '',
      is_featured: c.is_featured,
      is_active: c.is_active,
    });
    setCharityError(null);
    setIsCharityModalOpen(true);
  };

  // Save Charity (Create or Update)
  const handleSaveCharity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCharityError(null);
    setIsSavingCharity(true);

    try {
      const isEdit = Boolean(editingCharity);
      const url = isEdit
        ? `/api/admin/charities/${editingCharity!.id}`
        : '/api/admin/charities';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(charityForm),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save charity');
      }

      setIsCharityModalOpen(false);
      await loadCharities();
    } catch (err: any) {
      setCharityError(err.message || 'Error saving charity');
    } finally {
      setIsSavingCharity(false);
    }
  };

  // Soft Deactivate Toggle
  const handleToggleActive = async (c: CharityItem) => {
    try {
      const res = await fetch(`/api/admin/charities/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !c.is_active }),
      });

      if (res.ok) {
        await loadCharities();
      }
    } catch (err) {
      console.error('Error toggling active state:', err);
    }
  };

  // Feature Toggle (sets this charity as featured; DB trigger unsets other)
  const handleSetFeatured = async (c: CharityItem) => {
    try {
      const res = await fetch(`/api/admin/charities/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_featured: true }),
      });

      if (res.ok) {
        await loadCharities();
      }
    } catch (err) {
      console.error('Error setting featured charity:', err);
    }
  };

  // Open Event Manager Modal
  const handleOpenEventsModal = async (c: CharityItem) => {
    setSelectedCharityForEvents(c);
    setIsLoadingEvents(true);
    setIsAddingEvent(false);
    setEventError(null);
    setEventForm({ id: '', title: '', event_date: '', location: '', description: '' });

    try {
      const res = await fetch(`/api/admin/charities/${c.id}/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Save Event (Create or Update)
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharityForEvents) return;

    setEventError(null);
    try {
      const isEdit = Boolean(eventForm.id);
      const url = isEdit
        ? `/api/admin/charities/${selectedCharityForEvents.id}/events/${eventForm.id}`
        : `/api/admin/charities/${selectedCharityForEvents.id}/events`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventForm.title,
          event_date: eventForm.event_date,
          location: eventForm.location || null,
          description: eventForm.description || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save event');

      // Refresh events list
      const updated = await fetch(`/api/admin/charities/${selectedCharityForEvents.id}/events`);
      if (updated.ok) {
        const data = await updated.json();
        setEvents(data.events || []);
      }
      setIsAddingEvent(false);
      setEventForm({ id: '', title: '', event_date: '', location: '', description: '' });
      await loadCharities();
    } catch (err: any) {
      setEventError(err.message || 'Error saving event');
    }
  };

  // Delete Event
  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedCharityForEvents) return;
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const res = await fetch(
        `/api/admin/charities/${selectedCharityForEvents.id}/events/${eventId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setEvents(events.filter((e) => e.id !== eventId));
        await loadCharities();
      }
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  return (
    <Container size="wide" className="pt-8 pb-16">
      {/* Heading & Add Action */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-white flex items-center gap-2.5">
            Charity Directory Management
            <span className="text-xs font-mono font-normal uppercase px-2.5 py-0.5 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/30">
              {charities.length} Causes
            </span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Manage partner charities, set the single featured cause, schedule golf events, and toggle soft deactivation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadCharities}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddCharity}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add New Charity
          </Button>
        </div>
      </div>

      {/* Charities List */}
      {isLoading ? (
        <GlassCard className="p-12 text-center">
          <div className="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading charities directory...</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {charities.map((c) => (
            <GlassCard
              key={c.id}
              glowColor={c.is_featured ? 'gold' : c.is_active ? 'default' : 'default'}
              className={`p-6 flex flex-col justify-between transition ${
                !c.is_active ? 'opacity-70 border-dashed' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-md bg-navy-950 border border-white/10 text-slate-300">
                    {c.category}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {c.is_featured && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-300 border border-gold-500/40 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Featured
                      </span>
                    )}

                    <StatusBadge
                      status={c.is_active ? 'active' : 'inactive'}
                      size="xs"
                      label={c.is_active ? 'Active' : 'Deactivated'}
                    />
                  </div>
                </div>

                <h3 className="text-base font-bold text-white mb-1 line-clamp-1">{c.name}</h3>
                <p className="text-xs font-mono text-gold-400/80 mb-2">/charities/{c.slug}</p>
                <p className="text-xs text-slate-400 line-clamp-3 mb-4">{c.description}</p>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-2.5">
                {/* Event count & view public link */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {c.event_count || 0} Events
                  </span>
                  {c.is_active && (
                    <Link
                      href={`/charities/${c.slug}`}
                      target="_blank"
                      className="text-gold-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      Public Page <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenEditCharity(c)}
                    className="flex-1 justify-center text-xs"
                    leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    Edit
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEventsModal(c)}
                    className="text-xs"
                    leftIcon={<Calendar className="w-3.5 h-3.5" />}
                  >
                    Events
                  </Button>

                  {!c.is_featured && c.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetFeatured(c)}
                      className="text-xs text-gold-300 hover:text-gold-200"
                      title="Set as sole featured charity"
                    >
                      Feature
                    </Button>
                  )}

                  <button
                    onClick={() => handleToggleActive(c)}
                    className={`p-2 rounded-xl border text-xs transition ${
                      c.is_active
                        ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10'
                        : 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                    }`}
                    title={c.is_active ? 'Soft deactivate' : 'Reactivate'}
                  >
                    {c.is_active ? <Ban className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Add / Edit Charity Modal */}
      {isCharityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-w-lg w-full bg-navy-900 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                {editingCharity ? 'Edit Charity Cause' : 'Add New Partner Charity'}
              </h3>
              <button
                onClick={() => setIsCharityModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCharity} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Charity Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hope Horizons Children's Foundation"
                  value={charityForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const autoSlug = name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '');
                    setCharityForm({
                      ...charityForm,
                      name,
                      slug: editingCharity ? charityForm.slug : autoSlug,
                    });
                  }}
                  className="w-full px-3.5 py-2 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Slug (URL Key) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. hope-horizons"
                    value={charityForm.slug}
                    onChange={(e) => setCharityForm({ ...charityForm, slug: e.target.value.toLowerCase() })}
                    className="w-full px-3.5 py-2 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Category *
                  </label>
                  <select
                    value={charityForm.category}
                    onChange={(e) => setCharityForm({ ...charityForm, category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                  >
                    <option value="Children & Healthcare">Children & Healthcare</option>
                    <option value="Environment">Environment</option>
                    <option value="Community & Housing">Community & Housing</option>
                    <option value="Veterans & Military">Veterans & Military</option>
                    <option value="Education & Youth">Education & Youth</option>
                    <option value="Animal Welfare">Animal Welfare</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Tagline (Catchphrase)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Transforming pediatric healthcare & critical care access"
                  value={charityForm.tagline}
                  onChange={(e) => setCharityForm({ ...charityForm, tagline: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  placeholder="Brief summary for cards"
                  value={charityForm.short_description}
                  onChange={(e) => setCharityForm({ ...charityForm, short_description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Full Mission Description *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detailed mission, impact stories, and community goals..."
                  value={charityForm.description}
                  onChange={(e) => setCharityForm({ ...charityForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-navy-950 border border-white/10 text-xs text-white focus:outline-none focus:border-gold-500/50"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={charityForm.is_featured}
                    onChange={(e) => setCharityForm({ ...charityForm, is_featured: e.target.checked })}
                    className="rounded bg-navy-950 border-white/20 text-gold-500 focus:ring-gold-400"
                  />
                  Featured Charity (Only 1 at a time)
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={charityForm.is_active}
                    onChange={(e) => setCharityForm({ ...charityForm, is_active: e.target.checked })}
                    className="rounded bg-navy-950 border-white/20 text-emerald-500 focus:ring-emerald-400"
                  />
                  Active in Directory
                </label>
              </div>

              {charityError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {charityError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsCharityModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSavingCharity}>
                  {editingCharity ? 'Save Changes' : 'Create Charity'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Events Management Modal */}
      {selectedCharityForEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-w-2xl w-full bg-navy-900 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gold-400" />
                  Golf Days & Events — {selectedCharityForEvents.name}
                </h3>
                <p className="text-xs text-slate-400">
                  Schedule upcoming charity tournaments and supporter golf outings.
                </p>
              </div>
              <button
                onClick={() => setSelectedCharityForEvents(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Event Form (Inline Add/Edit) */}
            {isAddingEvent ? (
              <form onSubmit={handleSaveEvent} className="p-4 rounded-xl bg-navy-950 border border-white/10 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">
                    {eventForm.id ? 'Edit Event' : 'New Golf Event'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingEvent(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Annual Charity Golf Classic 2026"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-navy-900 border border-white/10 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Event Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={eventForm.event_date}
                      onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-navy-900 border border-white/10 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Location / Golf Club
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. The Belfry, Warwickshire"
                      value={eventForm.location}
                      onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-navy-900 border border-white/10 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Event itinerary, Stableford tournament rules, entry details..."
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-navy-900 border border-white/10 text-xs text-white"
                  />
                </div>

                {eventError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/15 text-rose-300 text-xs">
                    {eventError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddingEvent(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit">
                    Save Event
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEventForm({ id: '', title: '', event_date: '', location: '', description: '' });
                  setIsAddingEvent(true);
                }}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Schedule New Event
              </Button>
            )}

            {/* Events List */}
            {isLoadingEvents ? (
              <p className="text-xs text-slate-400 text-center py-4">Loading events...</p>
            ) : events.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No events currently scheduled for this charity.
              </p>
            ) : (
              <div className="space-y-2.5 pt-2">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-xl bg-navy-950 border border-white/5 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-white">{ev.title}</h4>
                      <div className="flex items-center gap-2 text-slate-400 mt-1">
                        <span className="text-gold-400 font-mono">
                          {new Date(ev.event_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {ev.location && <span>• {ev.location}</span>}
                      </div>
                      {ev.description && (
                        <p className="text-slate-400 mt-1.5 line-clamp-2 text-[11px]">
                          {ev.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEventForm({
                            id: ev.id,
                            title: ev.title,
                            event_date: ev.event_date.slice(0, 10),
                            location: ev.location || '',
                            description: ev.description || '',
                          });
                          setIsAddingEvent(true);
                        }}
                        className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Container>
  );
}
