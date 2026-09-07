import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useHemisphere } from '../hooks/useHemisphere';
import { playChimeClick } from '../utils/kkAudioSynthesizer';

interface EventRaw {
    name: string;
    type: string;
    displayName?: string;
    eventNotes?: string | null;
    datesNorthernHemisphere?: string | null;
    datesSouthernHemisphere?: string | null;
    year?: number;
    versionAdded?: string;
    unlockDate?: string;
    unlockMethod?: string;
}

interface GameEvent {
    name: string;
    displayName: string;
    type: string;
    dates: string;
    notes: string;
    year: number | null;
    unlockDate: string | null;
    startDate: Date | null;
    endDate: Date | null;
}

type EventView = 'calendar' | 'list';
type EventFilterType = 'all' | 'active' | 'upcoming' | 'past';

const EVENT_BAR_COLORS: Record<string, { bg: string; text: string }> = {
    'Nook Shopping event': { bg: '#16a34a', text: '#fff' },
    'Zodiac':              { bg: '#d97706', text: '#fff' },
    'Bug-Off':             { bg: '#dc2626', text: '#fff' },
    'Fishing Tourney':     { bg: '#0ea5e9', text: '#fff' },
    'Special character':   { bg: '#6366f1', text: '#fff' },
    'Season':              { bg: '#059669', text: '#fff' },
    'Fireworks Show':      { bg: '#f97316', text: '#fff' },
    'Birthday':            { bg: '#ec4899', text: '#fff' },
};

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarEventBar {
    event: GameEvent;
    startCol: number;
    span: number;
    isFirstRow: boolean;
    isLastRow: boolean;
    color: { bg: string; text: string };
}

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    bars: CalendarEventBar[];
}

function buildCalendarGrid(year: number, month: number, events: GameEvent[]): CalendarDay[][] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const today = new Date();
    const days: CalendarDay[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
        days.push({ date: new Date(year, month, -i), isCurrentMonth: false, isToday: false, bars: [] });
    }
    for (let d = 1; d <= totalDays; d++) {
        const date = new Date(year, month, d);
        const isToday = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
        days.push({ date, isCurrentMonth: true, isToday, bars: [] });
    }
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false, isToday: false, bars: [] });
    }
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    events.forEach((ev) => {
        if (!ev.startDate || !ev.endDate) return;
        const color = EVENT_BAR_COLORS[ev.type] || { bg: '#94a3b8', text: '#fff' };
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
        const evStart = ev.startDate < monthStart ? new Date(monthStart) : ev.startDate;
        const evEnd = ev.endDate > monthEnd ? new Date(monthEnd) : ev.endDate;
        if (evStart > monthEnd || evEnd < monthStart) return;
        weeks.forEach((week) => {
            const weekStart = new Date(week[0].date); weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(week[6].date); weekEnd.setHours(23, 59, 59, 999);
            if (evStart > weekEnd || evEnd < weekStart) return;
            let startCol = -1; let span = 0;
            for (let ci = 0; ci < 7; ci++) {
                const ds = new Date(week[ci].date); ds.setHours(0, 0, 0, 0);
                const de = new Date(week[ci].date); de.setHours(23, 59, 59, 999);
                if (evStart <= de && evEnd >= ds) { if (startCol < 0) startCol = ci; span++; }
            }
            if (startCol >= 0 && span > 0) {
                week[startCol].bars.push({
                    event: ev, startCol, span,
                    isFirstRow: ev.startDate! >= weekStart,
                    isLastRow: ev.endDate! <= weekEnd,
                    color,
                });
            }
        });
    });
    return weeks;
}

const EVENT_TYPE_ICONS: Record<string, string> = {
    'Nook Shopping event': 'fa-bag-shopping',
    'Zodiac': 'fa-star',
    'Bug-Off': 'fa-bug',
    'Fishing Tourney': 'fa-fish',
    'Special character': 'fa-user-tie',
    'Season': 'fa-leaf',
    'Fireworks Show': 'fa-burst',
    'Birthday': 'fa-cake-candles',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
    'Nook Shopping event': 'success',
    'Zodiac': 'warning',
    'Bug-Off': 'danger',
    'Fishing Tourney': 'info',
    'Special character': 'primary',
    'Season': 'success',
    'Fireworks Show': 'danger',
    'Birthday': 'warning',
};

const parseDateRange = (dateStr: string, year?: number): { start: Date; end: Date } | null => {
    if (!dateStr) return null;
    const y = year ?? new Date().getFullYear();
    const monthMap: Record<string, number> = {
        'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
        'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11,
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11,
    };
    const rangeMatch = dateStr.match(/(\w+)\s+(\d+)\s*[–-]\s*(\w+)\s+(\d+)/);
    if (rangeMatch) {
        const startMonth = monthMap[rangeMatch[1]];
        const startDay = parseInt(rangeMatch[2]);
        const endMonth = monthMap[rangeMatch[3]];
        const endDay = parseInt(rangeMatch[4]);
        if (startMonth !== undefined && endMonth !== undefined) {
            const endYear = endMonth < startMonth ? y + 1 : y;
            return { start: new Date(y, startMonth, startDay), end: new Date(endYear, endMonth, endDay, 23, 59, 59) };
        }
    }
    const singleMatch = dateStr.match(/(\w+)\s+(\d+)/);
    if (singleMatch) {
        const month = monthMap[singleMatch[1]];
        const day = parseInt(singleMatch[2]);
        if (month !== undefined) {
            return { start: new Date(y, month, day), end: new Date(y, month, day, 23, 59, 59) };
        }
    }
    return null;
};

const Events: React.FC = () => {
    const { isNorth, setHemisphere } = useHemisphere();
    const [events, setEvents] = useState<GameEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<EventView>('calendar');
    const [filterType, setFilterType] = useState<EventFilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [eventTypeFilter, setEventTypeFilter] = useState('All');
    const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
    const [tooltip, setTooltip] = useState<{ ev: GameEvent; x: number; y: number } | null>(null);

    const now = useMemo(() => new Date(), []);

    // Load seasons/events data
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const eventsMod = await import('@bitress/animal-crossing/lib/data/SeasonsAndEvents.json');
                const seasonsAndEvents = (eventsMod.default || eventsMod) as any[];
                if (!mounted || !Array.isArray(seasonsAndEvents)) return;

                const mapped: GameEvent[] = (seasonsAndEvents as any[]).map((ev: EventRaw) => {
                    const dateStr = isNorth ? ev.datesNorthernHemisphere : ev.datesSouthernHemisphere;
                    const parsed = parseDateRange(dateStr || '');

                    return {
                        name: ev.name,
                        displayName: ev.displayName || ev.name,
                        type: ev.type || 'Event',
                        dates: dateStr || 'See in-game',
                        notes: ev.eventNotes || '',
                        year: ev.year || null,
                        unlockDate: ev.unlockDate || null,
                        startDate: parsed?.start || null,
                        endDate: parsed?.end || null,
                    };
                });

                setEvents(mapped);
            } catch (err) {
                console.error('Failed to load events data:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [isNorth]);

    // Categorize events
    const activeEvents = useMemo(() =>
        events.filter(ev => ev.startDate && ev.endDate && now >= ev.startDate && now <= ev.endDate),
        [events, now]
    );

    const upcomingEvents = useMemo(() =>
        events
            .filter(ev => ev.startDate && now < ev.startDate)
            .sort((a, b) => (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0)),
        [events, now]
    );

    const pastEvents = useMemo(() =>
        events
            .filter(ev => ev.endDate && now > ev.endDate)
            .sort((a, b) => (b.endDate?.getTime() || 0) - (a.endDate?.getTime() || 0)),
        [events, now]
    );

    const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;
    const daysUntilNext = nextEvent?.startDate
        ? Math.ceil((nextEvent.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    const prevMonth = useCallback(() => {
        playChimeClick();
        setCalendarMonth(m => { if (m === 0) { setCalendarYear(y => y - 1); return 11; } return m - 1; });
    }, []);
    const nextMonth = useCallback(() => {
        playChimeClick();
        setCalendarMonth(m => { if (m === 11) { setCalendarYear(y => y + 1); return 0; } return m + 1; });
    }, []);
    const goToday = useCallback(() => {
        playChimeClick();
        setCalendarYear(new Date().getFullYear());
        setCalendarMonth(new Date().getMonth());
    }, []);

    const eventTypes = useMemo(() => {
        const types = new Set<string>();
        events.forEach(ev => types.add(ev.type));
        return ['All', ...Array.from(types).sort()];
    }, [events]);

    const filteredEvents = useMemo(() => {
        let list: GameEvent[];
        switch (filterType) {
            case 'active': list = activeEvents; break;
            case 'upcoming': list = upcomingEvents; break;
            case 'past': list = pastEvents; break;
            default: list = events;
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(ev =>
                ev.displayName.toLowerCase().includes(q) ||
                ev.type.toLowerCase().includes(q) ||
                ev.dates.toLowerCase().includes(q)
            );
        }
        if (eventTypeFilter !== 'All') list = list.filter(ev => ev.type === eventTypeFilter);
        return list;
    }, [filterType, activeEvents, upcomingEvents, pastEvents, events, searchQuery, eventTypeFilter]);

    const calendarGrid = useMemo(() => buildCalendarGrid(calendarYear, calendarMonth, events), [calendarYear, calendarMonth, events]);

    const getEventIcon = (type: string): string => EVENT_TYPE_ICONS[type] || 'fa-calendar-day';
    const getEventColor = (type: string): string => EVENT_TYPE_COLORS[type] || 'secondary';
    const isEventActive = (ev: GameEvent): boolean =>
        !!(ev.startDate && ev.endDate && now >= ev.startDate && now <= ev.endDate);

    const site = typeof window !== 'undefined' ? window.location.origin : 'https://www.chopaeng.com';
    const pageTitle = 'ACNH Seasons & Events Calendar | Chopaeng';
    const pageDesc = `Complete Animal Crossing: New Horizons events timeline for the ${isNorth ? 'Northern' : 'Southern'} Hemisphere. Track seasonal events, Nook Shopping dates, tournaments, and special visitors.`;

    return (
        <>
            <Helmet>
                <title>{pageTitle}</title>
                <meta name="description" content={pageDesc} />
                <link rel="canonical" href={`${site}/events`} />
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDesc} />
                <meta property="og:image" content={`${site}/banner.png`} />
                <meta property="og:url" content={`${site}/events`} />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image" />
            </Helmet>

            {tooltip && (
                <div className="ev-cal-tooltip" style={{ left: tooltip.x, top: tooltip.y }} onMouseLeave={() => setTooltip(null)}>
                    <div className="ev-cal-tooltip-name">{tooltip.ev.displayName}</div>
                    <div className="ev-cal-tooltip-type"><i className={`fa-solid ${getEventIcon(tooltip.ev.type)} me-1`} />{tooltip.ev.type}</div>
                    {tooltip.ev.dates && <div className="ev-cal-tooltip-dates"><i className="fa-regular fa-calendar me-1" />{tooltip.ev.dates}</div>}
                    {tooltip.ev.notes && <div className="ev-cal-tooltip-notes">{tooltip.ev.notes}</div>}
                </div>
            )}

            <div className="min-vh-100 nook-bg py-5">
                <div className="container py-4">
                    {/* Header */}
                    <div className="text-center mb-4 animate-up">
                        <span className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-3 py-2 fw-bold text-uppercase tracking-wider mb-2">
                            <i className="fa-solid fa-calendar-days me-1" aria-hidden="true" /> Seasons &amp; Events
                        </span>
                        <h1 className="display-5 fw-black text-dark ac-font mb-2">Events Calendar</h1>
                        <p className="lead text-muted mx-auto fw-bold mb-3" style={{ maxWidth: '640px' }}>
                            Track in-game seasons, holidays, fishing tourneys, Bug-Offs, and special visitor events.
                        </p>
                        <div className="ac-nav-tabs-pill d-inline-flex">
                            <button type="button" className={`ac-tab-btn ${isNorth ? 'active' : ''}`}
                                onClick={() => { playChimeClick(); setHemisphere('north'); }}>
                                <i className="fa-solid fa-snowflake me-1" aria-hidden="true" /> Northern
                            </button>
                            <button type="button" className={`ac-tab-btn ${!isNorth ? 'active' : ''}`}
                                onClick={() => { playChimeClick(); setHemisphere('south'); }}>
                                <i className="fa-solid fa-sun me-1" aria-hidden="true" /> Southern
                            </button>
                        </div>
                    </div>

                    {/* Active Events Spotlight + Countdown */}
                    {!loading && (
                        <div className="row g-3 mb-4 animate-up">
                            {/* Active Events */}
                            {activeEvents.length > 0 && (
                                <div className="col-12 col-md-7">
                                    <div className="ac-event-item ac-event-item--success h-100 p-4">
                                        <div className="d-flex align-items-center justify-content-between mb-3">
                                            <span className="badge bg-success text-white rounded-pill px-3 py-2 fw-black text-uppercase tracking-wider" style={{ fontSize: '0.75rem' }}>
                                                <span className="ac-live-pulse-dot bg-white" /> Happening Now
                                            </span>
                                            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1 fw-bold tiny-text">
                                                {activeEvents.length} Active {activeEvents.length === 1 ? 'Event' : 'Events'}
                                            </span>
                                        </div>
                                        {activeEvents.map((ev, i) => (
                                            <div key={i} className={`d-flex align-items-start gap-3 ${i > 0 ? 'mt-3 pt-3 border-top' : ''}`}>
                                                <div
                                                    className={`ac-stat-icon-wrapper ac-stat-icon-wrapper--${getEventColor(ev.type)} flex-shrink-0 m-0`}
                                                    style={{ width: 44, height: 44 }}
                                                >
                                                    <i className={`fa-solid ${getEventIcon(ev.type)}`} aria-hidden="true" />
                                                </div>
                                                <div className="flex-grow-1 min-w-0">
                                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                                        <h3 className="fw-black text-dark mb-0" style={{ fontSize: '1.05rem' }}>{ev.displayName}</h3>
                                                        <span className="badge bg-success text-white rounded-pill px-2 py-1 fw-black" style={{ fontSize: '0.62rem' }}>
                                                            LIVE
                                                        </span>
                                                    </div>
                                                    <div className="tiny-text text-muted fw-bold mt-1">
                                                        <i className="fa-regular fa-calendar me-1" aria-hidden="true" />
                                                        {ev.dates}
                                                    </div>
                                                    {ev.notes && <div className="tiny-text text-muted mt-1 fst-italic">{ev.notes}</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Countdown to Next Event */}
                            {nextEvent && (
                                <div className={`col-12 ${activeEvents.length > 0 ? 'col-md-5' : 'col-md-12'}`}>
                                    <div className="ac-stat-card p-4 h-100 text-center d-flex flex-column justify-content-center">
                                        <div className="mb-2">
                                            <span className="badge bg-info-subtle text-info border border-info-subtle rounded-pill px-3 py-2 fw-black text-uppercase tracking-wider" style={{ fontSize: '0.72rem' }}>
                                                <i className="fa-solid fa-hourglass-half me-1" aria-hidden="true" /> Next Upcoming Event
                                            </span>
                                        </div>
                                        <div
                                            className="ac-stat-icon-wrapper ac-stat-icon-wrapper--blue mx-auto mb-2"
                                            style={{ width: 56, height: 56, fontSize: '1.4rem' }}
                                        >
                                            <i className={`fa-solid ${getEventIcon(nextEvent.type)}`} aria-hidden="true" />
                                        </div>
                                        <h3 className="fw-black text-dark mb-1" style={{ fontSize: '1.15rem' }}>{nextEvent.displayName}</h3>
                                        <div className="tiny-text text-muted fw-bold mb-3">{nextEvent.dates}</div>
                                        {daysUntilNext !== null && (
                                            <div className="d-inline-flex align-items-baseline justify-content-center gap-2 bg-light rounded-pill px-4 py-2 border mx-auto">
                                                <span className="fs-2 fw-black text-dark">{daysUntilNext}</span>
                                                <span className="fw-bold text-muted small">{daysUntilNext === 1 ? 'day away' : 'days away'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Fallback when no active or next events */}
                            {activeEvents.length === 0 && !nextEvent && (
                                <div className="col-12">
                                    <div className="ac-filter-bar text-center py-4">
                                        <i className="fa-solid fa-calendar-xmark fs-2 text-muted opacity-50 mb-2" aria-hidden="true" />
                                        <p className="fw-bold text-muted mb-0">No active or upcoming events detected for this date range.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* View Toggle */}
                    <div className="d-flex align-items-center justify-content-between mb-3 gap-2 flex-wrap">
                        <div className="ac-nav-tabs-pill d-inline-flex">
                            <button type="button" id="events-view-calendar"
                                className={`ac-tab-btn ${view === 'calendar' ? 'active' : ''}`}
                                onClick={() => { playChimeClick(); setView('calendar'); }}>
                                <i className="fa-solid fa-calendar-days me-1" aria-hidden="true" /> Calendar
                            </button>
                            <button type="button" id="events-view-list"
                                className={`ac-tab-btn ${view === 'list' ? 'active' : ''}`}
                                onClick={() => { playChimeClick(); setView('list'); }}>
                                <i className="fa-solid fa-list me-1" aria-hidden="true" /> List
                            </button>
                        </div>
                        {view === 'list' && (
                            <select className="ac-select-pill" style={{ maxWidth: 200 }}
                                value={eventTypeFilter} aria-label="Filter by event type"
                                onChange={(e) => setEventTypeFilter(e.target.value)}>
                                {eventTypes.map(t => <option key={t} value={t}>Type: {t}</option>)}
                            </select>
                        )}
                    </div>

                    {/* CALENDAR VIEW */}
                    {view === 'calendar' && (
                        <div className="ev-cal-wrapper animate-fade-in">
                            <div className="ev-cal-header">
                                <button type="button" id="events-cal-prev" className="ev-cal-nav-btn" aria-label="Previous month" onClick={prevMonth}>
                                    <i className="fa-solid fa-chevron-left" />
                                </button>
                                <div className="ev-cal-month-label">
                                    <span className="ev-cal-month-name">{MONTH_NAMES[calendarMonth]}</span>
                                    <span className="ev-cal-year">{calendarYear}</span>
                                </div>
                                <button type="button" id="events-cal-today" className="ev-cal-today-btn" onClick={goToday}>Today</button>
                                <button type="button" id="events-cal-next" className="ev-cal-nav-btn" aria-label="Next month" onClick={nextMonth}>
                                    <i className="fa-solid fa-chevron-right" />
                                </button>
                            </div>

                            {loading ? (
                                <div className="text-center py-5" role="status">
                                    <div className="spinner-border text-success mb-2" aria-hidden="true" />
                                    <div className="fw-bold text-muted">Loading events&hellip;</div>
                                </div>
                            ) : (
                                <div className="ev-cal-grid-wrap">
                                    <div className="ev-cal-day-headers">
                                        {DAY_NAMES_SHORT.map(d => <div key={d} className="ev-cal-day-header">{d}</div>)}
                                    </div>
                                    {calendarGrid.map((week, wi) => (
                                        <div key={wi} className="ev-cal-week">
                                            <div className="ev-cal-dates-row">
                                                {week.map((day, di) => (
                                                    <div key={di} className={`ev-cal-date-cell ${!day.isCurrentMonth ? 'ev-cal-date-cell--other' : ''} ${day.isToday ? 'ev-cal-date-cell--today' : ''}`}>
                                                        <span className={`ev-cal-date-num ${day.isToday ? 'ev-cal-date-num--today' : ''}`}>{day.date.getDate()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="ev-cal-bars-row">
                                                {week.map((day) =>
                                                    day.bars.map((bar, bi) => (
                                                        <div key={`${bar.startCol}-${bi}`}
                                                            className={`ev-cal-bar ${bar.isFirstRow ? 'ev-cal-bar--first' : ''} ${bar.isLastRow ? 'ev-cal-bar--last' : ''}`}
                                                            style={{ gridColumnStart: bar.startCol + 1, gridColumnEnd: bar.startCol + bar.span + 1, backgroundColor: bar.color.bg, color: bar.color.text }}
                                                            title={bar.event.displayName}
                                                            onMouseEnter={(e) => {
                                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                                setTooltip({ ev: bar.event, x: rect.left + window.scrollX, y: rect.bottom + window.scrollY + 8 });
                                                            }}
                                                            onMouseLeave={() => setTooltip(null)}>
                                                            {bar.isFirstRow && (
                                                                <span className="ev-cal-bar-label">
                                                                    <i className={`fa-solid ${getEventIcon(bar.event.type)}`} aria-hidden="true" />
                                                                    {bar.event.displayName}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!loading && (
                                <div className="ev-cal-legend">
                                    {Object.entries(EVENT_BAR_COLORS).map(([type, color]) => (
                                        <span key={type} className="ev-cal-legend-item">
                                            <span className="ev-cal-legend-dot" style={{ backgroundColor: color.bg }} />
                                            {type}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* LIST VIEW */}
                    {view === 'list' && (
                        <>
                            <div className="text-center mb-4">
                                <div className="ac-nav-tabs-pill d-inline-flex flex-wrap justify-content-center" role="tablist">
                                    {([
                                        { id: 'all' as EventFilterType, label: 'All Events', icon: 'fa-list', count: events.length },
                                        { id: 'active' as EventFilterType, label: 'Active Now', icon: 'fa-circle-play', count: activeEvents.length },
                                        { id: 'upcoming' as EventFilterType, label: 'Upcoming', icon: 'fa-forward', count: upcomingEvents.length },
                                        { id: 'past' as EventFilterType, label: 'Past', icon: 'fa-backward', count: pastEvents.length },
                                    ]).map((tab) => (
                                        <button key={tab.id} type="button"
                                            className={`ac-tab-btn ${filterType === tab.id ? 'active' : ''}`}
                                            role="tab" aria-selected={filterType === tab.id}
                                            onClick={() => { playChimeClick(); setFilterType(tab.id); }}>
                                            <i className={`fa-solid ${tab.icon}`} aria-hidden="true" />
                                            <span>{tab.label}</span>
                                            <span className="badge rounded-pill bg-white text-dark ms-1" style={{ fontSize: '0.65rem' }}>
                                                {loading ? '…' : tab.count}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="ac-filter-bar mb-4">
                                <div className="ac-search-input-group">
                                    <i className="fa-solid fa-magnifying-glass text-muted" aria-hidden="true" />
                                    <input type="text" className="ac-search-input"
                                        placeholder="Search events by name, type, date..."
                                        value={searchQuery} aria-label="Search events"
                                        onChange={(e) => setSearchQuery(e.target.value)} />
                                    {searchQuery && (
                                        <button type="button" className="btn btn-sm btn-link text-muted p-0" onClick={() => setSearchQuery('')}>
                                            <i className="fa-solid fa-xmark" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {loading ? (
                                <div className="text-center py-5" role="status" aria-live="polite">
                                    <div className="spinner-border text-success mb-2" aria-hidden="true" />
                                    <div className="fw-bold text-muted">Loading events data...</div>
                                </div>
                            ) : filteredEvents.length === 0 ? (
                                <div className="ac-filter-bar text-center py-5 text-muted animate-fade-in">
                                    <i className="fa-solid fa-calendar-xmark fs-1 mb-2 opacity-50 text-warning" aria-hidden="true" />
                                    <p className="fw-bold mb-0">No events match your filter.</p>
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-3 animate-fade-in">
                                    {filteredEvents.map((ev, idx) => {
                                        const active = isEventActive(ev);
                                        const color = getEventColor(ev.type);
                                        return (
                                            <div key={`${ev.name}-${idx}`} className={`ac-event-item ac-event-item--${color}`}>
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className={`ac-stat-icon-wrapper ac-stat-icon-wrapper--${color} flex-shrink-0 m-0`} style={{ width: 44, height: 44 }}>
                                                        <i className={`fa-solid ${getEventIcon(ev.type)}`} aria-hidden="true" />
                                                    </div>
                                                    <div className="flex-grow-1 min-w-0">
                                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                                            <h3 className="fw-black text-dark mb-0 text-truncate" style={{ fontSize: '1rem' }}>{ev.displayName}</h3>
                                                            {active && (
                                                                <span className="badge bg-success text-white rounded-pill px-2 py-1 fw-black" style={{ fontSize: '0.65rem' }}>
                                                                    <span className="ac-live-pulse-dot bg-white" />LIVE
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="tiny-text text-muted fw-bold mt-1">
                                                            <i className="fa-regular fa-calendar me-1" aria-hidden="true" />{ev.dates}
                                                        </div>
                                                    </div>
                                                    <span className={`badge bg-${color}-subtle text-${color} border border-${color}-subtle rounded-pill px-3 py-1 fw-bold flex-shrink-0`} style={{ fontSize: '0.72rem' }}>{ev.type}</span>
                                                </div>
                                                {ev.notes && <div className="mt-2 ps-5 ms-3"><p className="tiny-text text-muted mb-0 fst-italic">{ev.notes}</p></div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* Bottom navigation */}
                    <div className="text-center mt-5">
                        <Link to="/critters" className="btn btn-outline-info rounded-pill px-4 py-2 fw-bold me-2" onClick={() => playChimeClick()}>
                            <i className="fa-solid fa-fish me-2" aria-hidden="true" />Critter Calendar
                        </Link>
                        <Link to="/catalog" className="btn btn-nook text-white rounded-pill px-4 py-2 fw-bold shadow-2xs" onClick={() => playChimeClick()}>
                            <i className="fa-solid fa-boxes-stacked me-2" aria-hidden="true" />Browse Catalogue
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Events;
