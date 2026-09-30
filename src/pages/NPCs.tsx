import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import BirthdayCalendar from '../components/BirthdayCalendar';
import { useCatalogData } from '../hooks/useCatalogData';
import { findBestGifts } from '../utils/giftMatcher';

interface NpcRaw {
    name: string;
    iconImage?: string;
    photoImage?: string;
    gender?: string;
    genderAsia?: string;
    birthday?: string;
    nameColor?: string;
    bubbleColor?: string;
    npcId?: string;
    sourceSheet?: string;
    translations?: { jPja?: string; kRko?: string };
}

interface VillagerRaw {
    name: string;
    iconImage?: string;
    species?: string;
    personality?: string;
    gender?: string;
    birthday?: string;
    hobby?: string;
}

interface NpcEntry {
    name: string;
    icon: string;
    photo: string;
    gender: string;
    birthday: string;
    nameColor: string;
    bubbleColor: string;
    japaneseName: string;
    koreanName: string;
}

type NpcTab = 'npcs' | 'birthdays';

const FALLBACK_IMAGE = 'https://acnhcdn.com/latest/FtrIcon/FtrLeaf.png';

const NPCs: React.FC = () => {
    const [npcs, setNpcs] = useState<NpcEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<NpcTab>('npcs');
    const [searchQuery, setSearchQuery] = useState('');
    const [genderFilter, setGenderFilter] = useState('All');
    const [birthdayMonth, setBirthdayMonth] = useState(new Date().getMonth());

    // Birthday entries (combined villagers + NPCs)
    const [birthdayEntries, setBirthdayEntries] = useState<{
        name: string; icon: string; birthday: string;
        personality?: string; species?: string; isNpc?: boolean;
        styles?: string[]; colors?: string[];
    }[]>([]);

    const { data: catalogData } = useCatalogData();

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const [npcsMod, villagersMod] = await Promise.all([
                    import('@bitress/animal-crossing/lib/data/NPCs.json'),
                    import('@bitress/animal-crossing/lib/data/Villagers.json'),
                ]);
                const rawNpcs = (npcsMod.default || npcsMod) as any[];
                const rawVillagers = (villagersMod.default || villagersMod) as any[];
                if (!mounted) return;

                if (Array.isArray(rawNpcs)) {
                    const mapped: NpcEntry[] = (rawNpcs as any[]).map((npc: NpcRaw) => ({
                        name: npc.name,
                        icon: npc.iconImage || FALLBACK_IMAGE,
                        photo: npc.photoImage || npc.iconImage || FALLBACK_IMAGE,
                        gender: npc.gender || 'Unknown',
                        birthday: npc.birthday || 'N/A',
                        nameColor: npc.nameColor || '#333333',
                        bubbleColor: npc.bubbleColor || '#ffffff',
                        japaneseName: npc.translations?.jPja || '',
                        koreanName: npc.translations?.kRko || '',
                    }));
                    setNpcs(mapped);
                }

                // Build birthday entries
                const bdays: typeof birthdayEntries = [];

                if (Array.isArray(rawVillagers)) {
                    for (const v of rawVillagers as VillagerRaw[]) {
                        if (v.birthday) {
                            bdays.push({
                                name: v.name,
                                icon: v.iconImage || FALLBACK_IMAGE,
                                birthday: v.birthday,
                                personality: v.personality,
                                species: v.species,
                                isNpc: false,
                            });
                        }
                    }
                }

                if (Array.isArray(rawNpcs)) {
                    for (const npc of rawNpcs as NpcRaw[]) {
                        if (npc.birthday) {
                            bdays.push({
                                name: npc.name,
                                icon: npc.iconImage || FALLBACK_IMAGE,
                                birthday: npc.birthday,
                                personality: 'Special NPC',
                                isNpc: true,
                            });
                        }
                    }
                }

                setBirthdayEntries(bdays);
            } catch (err) {
                console.error('Failed to load NPC data:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, []);

    const genders = useMemo(() => {
        const set = new Set<string>();
        npcs.forEach(n => set.add(n.gender));
        return ['All', ...Array.from(set).sort()];
    }, [npcs]);

    const filteredNpcs = useMemo(() => {
        let list = npcs;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(n =>
                n.name.toLowerCase().includes(q) ||
                n.japaneseName.includes(q) ||
                n.koreanName.includes(q)
            );
        }

        if (genderFilter !== 'All') {
            list = list.filter(n => n.gender === genderFilter);
        }

        return list;
    }, [npcs, searchQuery, genderFilter]);

    const site = typeof window !== 'undefined' ? window.location.origin : 'https://www.chopaeng.com';
    const pageTitle = 'ACNH Special NPCs & Birthday Calendar | Chopaeng';
    const pageDesc = 'Browse all 65 special NPCs in Animal Crossing: New Horizons and track every villager birthday with our interactive birthday calendar.';

    // ── Today's birthdays gift matcher ───────────────────────────────────
    const todayBirthdays = useMemo(() => {
        const today = new Date();
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const todayStr = `${monthNames[today.getMonth()]} ${today.getDate()}`; // e.g. "September 29"
        return birthdayEntries.filter(e => e.birthday === todayStr && !e.isNpc);
    }, [birthdayEntries]);

    return (
        <>
            <Helmet>
                <title>{pageTitle}</title>
                <meta name="description" content={pageDesc} />
                <link rel="canonical" href={`${site}/npcs`} />
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDesc} />
                <meta property="og:image" content={`${site}/banner.png`} />
                <meta property="og:url" content={`${site}/npcs`} />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image" />
            </Helmet>

            <div className="min-vh-100 nook-bg py-5">
                <div className="container py-4">
                    {/* Header */}
                    <div className="text-center mb-5 animate-up">
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-2 fw-bold text-uppercase tracking-wider mb-2">
                            <i className="fa-solid fa-user-tie me-1" aria-hidden="true" /> Character Gallery
                        </span>
                        <h1 className="display-5 fw-black text-dark ac-font mb-2">
                            NPCs & Birthdays
                        </h1>
                        <p className="lead text-muted mx-auto fw-bold" style={{ maxWidth: '640px' }}>
                            Meet every special NPC in Animal Crossing: New Horizons and track every villager birthday.
                        </p>
                    </div>

                    {/* Tab Navigation */}
                    <div className="text-center mb-4">
                        <div className="ac-nav-tabs-pill d-inline-flex flex-wrap justify-content-center" role="tablist">
                            <button
                                type="button"
                                className={`ac-tab-btn ${activeTab === 'npcs' ? 'active' : ''}`}
                                role="tab"
                                aria-selected={activeTab === 'npcs'}
                                onClick={() => { playChimeClick(); setActiveTab('npcs'); }}
                            >
                                <i className="fa-solid fa-user-tie" aria-hidden="true" />
                                <span>Special NPCs</span>
                                <span className="badge rounded-pill bg-white text-dark ms-1" style={{ fontSize: '0.65rem' }}>
                                    {loading ? '…' : npcs.length}
                                </span>
                            </button>
                            <button
                                type="button"
                                className={`ac-tab-btn ${activeTab === 'birthdays' ? 'active' : ''}`}
                                role="tab"
                                aria-selected={activeTab === 'birthdays'}
                                onClick={() => { playChimeClick(); setActiveTab('birthdays'); }}
                            >
                                <i className="fa-solid fa-cake-candles" aria-hidden="true" />
                                <span>Birthday Calendar</span>
                                <span className="badge rounded-pill bg-white text-dark ms-1" style={{ fontSize: '0.65rem' }}>
                                    {loading ? '…' : birthdayEntries.length}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Today's Birthday Gift Matcher */}
                    {!loading && todayBirthdays.length > 0 && (
                        <div className="mb-4 animate-fade-in">
                            {todayBirthdays.map((bday) => {
                                const giftSuggestions = catalogData
                                    ? findBestGifts(catalogData.items || [], [], [], 6)
                                    : [];
                                return (
                                    <div key={bday.name} className="card rounded-4 border border-warning-subtle shadow-2xs p-4 mb-3 bg-warning-subtle">
                                        <div className="d-flex align-items-center gap-3 mb-3">
                                            <img
                                                src={bday.icon}
                                                alt={bday.name}
                                                className="rounded-circle border border-warning"
                                                style={{ width: 56, height: 56, objectFit: 'contain', background: '#fff' }}
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE; }}
                                            />
                                            <div>
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <span className="badge bg-warning text-dark rounded-pill fw-black" style={{ fontSize: '0.65rem' }}>
                                                        <i className="fa-solid fa-cake-candles me-1" aria-hidden="true" />
                                                        Birthday Today!
                                                    </span>
                                                </div>
                                                <h3 className="fw-black text-dark mb-0" style={{ fontSize: '1.1rem' }}>{bday.name}</h3>
                                                {bday.personality && (
                                                    <div className="tiny-text text-muted fw-bold">{bday.personality} · {bday.species}</div>
                                                )}
                                            </div>
                                        </div>
                                        {giftSuggestions.length > 0 && (
                                            <>
                                                <div className="tiny-text text-muted fw-bold text-uppercase mb-2">
                                                    <i className="fa-solid fa-gift me-1" aria-hidden="true" /> Top Gift Ideas
                                                </div>
                                                <div className="d-flex flex-wrap gap-2">
                                                    {giftSuggestions.map(({ item }) => (
                                                        <Link
                                                            key={item.id}
                                                            to={`/item/${item.id}`}
                                                            className="btn btn-xs btn-light border rounded-pill fw-bold d-flex align-items-center gap-1 shadow-2xs"
                                                            style={{ fontSize: '0.72rem' }}
                                                            onClick={() => playChimeClick()}
                                                        >
                                                            {item.image && (
                                                                <img src={item.image} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} aria-hidden="true" />
                                                            )}
                                                            {item.name}
                                                        </Link>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* NPC Tab */}
                    {activeTab === 'npcs' && (
                        <div className="animate-fade-in">
                            {/* Search & Filter */}
                            <div className="ac-filter-bar mb-4">
                                <div className="row g-2 align-items-center">
                                    <div className="col-12 col-md-8">
                                        <div className="ac-search-input-group">
                                            <i className="fa-solid fa-magnifying-glass text-muted" aria-hidden="true" />
                                            <input
                                                type="text"
                                                className="ac-search-input"
                                                placeholder="Search NPC name (English, Japanese, Korean)..."
                                                value={searchQuery}
                                                aria-label="Search NPCs"
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-link text-muted p-0"
                                                    onClick={() => setSearchQuery('')}
                                                >
                                                    <i className="fa-solid fa-xmark" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-12 col-md-4">
                                        <select
                                            className="ac-select-pill"
                                            value={genderFilter}
                                            aria-label="Filter by gender"
                                            onChange={(e) => setGenderFilter(e.target.value)}
                                        >
                                            {genders.map(g => (
                                                <option key={g} value={g}>Gender: {g}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* NPC Grid */}
                            {loading ? (
                                <div className="text-center py-5" role="status" aria-live="polite">
                                    <div className="spinner-border text-success mb-2" aria-hidden="true" />
                                    <div className="fw-bold text-muted">Loading NPCs...</div>
                                </div>
                            ) : filteredNpcs.length === 0 ? (
                                <div className="ac-filter-bar text-center py-5 text-muted">
                                    <i className="fa-solid fa-user-slash fs-1 mb-2 opacity-50" aria-hidden="true" />
                                    <p className="fw-bold mb-0">No NPCs match your search.</p>
                                </div>
                            ) : (
                                <div className="row g-3">
                                    {filteredNpcs.map((npc, idx) => (
                                        <div key={idx} className="col-6 col-md-4 col-lg-3">
                                            <div className="ac-grid-card text-center">
                                                <div className="position-relative mx-auto mb-3">
                                                    <img
                                                        src={npc.icon}
                                                        alt={npc.name}
                                                        className="rounded-circle shadow-sm"
                                                        style={{
                                                            width: 76,
                                                            height: 76,
                                                            objectFit: 'contain',
                                                            border: `3px solid ${npc.nameColor || '#cbd5e1'}`,
                                                            backgroundColor: npc.bubbleColor || '#ffffff',
                                                            padding: 4
                                                        }}
                                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE; }}
                                                    />
                                                </div>

                                                <h3 className="fw-black text-dark mb-1" style={{ fontSize: '1rem', color: npc.nameColor }}>
                                                    {npc.name}
                                                </h3>

                                                {npc.japaneseName && (
                                                    <div className="tiny-text text-muted fw-bold mb-2">{npc.japaneseName}</div>
                                                )}

                                                <div className="d-flex flex-wrap justify-content-center gap-1 mt-auto">
                                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '0.68rem' }}>
                                                        {npc.gender}
                                                    </span>
                                                    {npc.birthday !== 'N/A' && (
                                                        <span className="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-2 py-1 fw-bold" style={{ fontSize: '0.68rem' }}>
                                                            <i className="fa-solid fa-cake-candles me-1" aria-hidden="true" />
                                                            {npc.birthday}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Birthday Calendar Tab */}
                    {activeTab === 'birthdays' && (
                        <div className="animate-fade-in">
                            {loading ? (
                                <div className="text-center py-5" role="status" aria-live="polite">
                                    <div className="spinner-border text-success mb-2" aria-hidden="true" />
                                    <div className="fw-bold text-muted">Loading birthday data...</div>
                                </div>
                            ) : (
                                <BirthdayCalendar
                                    entries={birthdayEntries}
                                    selectedMonth={birthdayMonth}
                                    onMonthChange={setBirthdayMonth}
                                />
                            )}
                        </div>
                    )}

                    {/* Bottom navigation */}
                    <div className="text-center mt-5">
                        <Link
                            to="/catalog?tab=villagers"
                            className="btn btn-nook text-white rounded-pill px-4 py-2 fw-bold shadow-2xs"
                            onClick={() => playChimeClick()}
                        >
                            <i className="fa-solid fa-users me-2" aria-hidden="true" />
                            Browse All Villagers
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
};

export default NPCs;
