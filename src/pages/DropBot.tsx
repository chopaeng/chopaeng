import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useIslandData } from '../context/useIslandData';
import { type IslandData } from '../data/islands';
import { useCommandBuilderPockets, type PocketItem } from '../hooks/useCommandBuilderPockets';
import { useCatalogData } from '../hooks/useCatalogData';
import { useFavorites } from '../hooks/useFavorites';
import { DROP_MAX } from '../constants/limits';
import { playChimeClick } from '../utils/kkAudioSynthesizer';
import { triggerConfetti } from '../utils/confetti';
import { CommandBuilderVariantModal } from '../components/command-builder/CommandBuilderVariantModal';
import { DropBotHouseGrid } from '../components/drop/DropBotHouseGrid';
import {
    submitIslandDrop,
    injectIslandVillager,
    batchInjectIslandVillagers,
    revealIslandDodoCode,
} from '../utils/dropBotApi';
import type { CatalogEntity } from '../data/commandBuilderData';
import { useSavedCharacters } from '../hooks/useSavedCharacters';
import SubRulesModal from '../components/sub/SubRulesModal';
import { SanrioGuidanceModal, isSanrioVillager } from '../components/villager/SanrioGuidanceModal';
import { isSubRulesAccepted } from '../utils/subRulesStorage';
import RevealErrorPopup from '../components/RevealErrorPopup';
import './OrderBot.css';

const FALLBACK_IMG =
    "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f3f5'/%3E%3Cpath d='M30 65 L45 45 L58 58 L68 42 L75 65 Z' fill='%23ced4da'/%3E%3Ccircle cx='38' cy='35' r='7' fill='%23ced4da'/%3E%3C/svg%3E";

const DROP_PRESETS = [
    {
        id: 'tickets',
        name: 'NMTs',
        fillType: 'tickets',
        icon: 'https://dodo.ac/np/images/4/43/Nook_Miles_Ticket_NH_Inv_Icon.png',
    },
    {
        id: 'crowns',
        name: 'Crowns',
        fillType: 'crowns',
        icon: 'https://dodo.ac/np/images/c/c7/Royal_Crown_NH_Storage_Icon.png',
    },
    {
        id: 'bells',
        name: '99k Bells',
        fillType: 'bells',
        icon: 'https://dodo.ac/np/images/1/1e/99k_Bells_NH_Inv_Icon.png',
    },
    {
        id: 'gold',
        name: 'Gold',
        fillType: 'gold',
        icon: 'https://dodo.ac/np/images/2/26/Gold_Nugget_NH_Inv_Icon.png',
    },
];

/* ─────────────────────────────────────────────────────────────
   UI-only helpers (no business logic)
───────────────────────────────────────────────────────────── */

const TABS = [
    { key: 'items', label: 'Items', icon: 'fa-boxes-stacked' },
    { key: 'favorites', label: 'Favorites', icon: 'fa-star' },
    { key: 'villagers', label: 'Villagers', icon: 'fa-house-chimney' },
] as const;

const EMPTY_HOUSES: Record<number, CatalogEntity | null> = {
    0: null, 1: null, 2: null, 3: null, 4: null,
    5: null, 6: null, 7: null, 8: null, 9: null,
};

/** Swap a broken image for the placeholder once (avoids an error loop). */
const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.src !== FALLBACK_IMG) img.src = FALLBACK_IMG;
};

/**
 * Clipboard write that never throws. navigator.clipboard is undefined on
 * insecure origins and some in-app browsers, which used to crash the copy
 * handlers before their .catch() could run.
 */
const copyText = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through to the legacy path
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
};

interface PassportCardProps {
    id: string;
    icon: string;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    action?: React.ReactNode;
    headingLevel?: 1 | 2;
    children: React.ReactNode;
}

/** Resident-passport card: green cover band + crest, stitched seam, white body. */
const PassportCard: React.FC<PassportCardProps> = ({
    id,
    icon,
    title,
    subtitle,
    action,
    headingLevel = 2,
    children,
}) => {
    const Heading = headingLevel === 1 ? 'h1' : 'h2';
    return (
        <section className="cpdb-card" aria-labelledby={`${id}-title`}>
            <div className="cpdb-cover">
                <span className="cpdb-crest" aria-hidden="true">
                    <i className={`fa-solid ${icon}`} />
                </span>
                <div className="cpdb-cover-text">
                    <Heading id={`${id}-title`} className="ac-font">
                        {title}
                    </Heading>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {action && <div className="cpdb-cover-action">{action}</div>}
            </div>
            <div className="cpdb-seam" aria-hidden="true" />
            <div className="cpdb-body">{children}</div>
        </section>
    );
};

const STYLES = `
.cpdb{
  --ink:#1d3328;--ink-soft:#5b6e63;--leaf:#1f8a4c;--leaf-dark:#166b3a;--leaf-deep:#0f4f2a;
  --line:#cfdcd3;--sky:#e3f4f1;--tint:#f3f9f6;--danger:#b42318;--danger-bg:#fdeceb;--danger-ink:#8a1c12;
  --warn-bg:#fff5dc;--warn-ink:#6e4500;--star:#a86f00;
  --shadow:0 14px 34px -16px rgba(22,107,58,.34);
  --r-card:26px;--r-ctl:14px;
  color:var(--ink);min-height:100vh;padding-bottom:48px;
  background:radial-gradient(120% 55% at 50% -12%,#fbfffd 0%,rgba(251,255,253,0) 62%),var(--sky);
}
.cpdb *,.cpdb *::before,.cpdb *::after{box-sizing:border-box}
.cpdb .ac-font{color:var(--ink)}
.cpdb--center{display:flex;align-items:center;justify-content:center;padding:32px 0}

/* focus */
.cpdb :is(button,a,input,select,textarea,[tabindex]):focus-visible{outline:3px solid var(--ink);outline-offset:2px}
.cpdb .cpdb-cover :focus-visible{outline-color:#fff}

/* hero */
.cpdb-hero{padding:32px 0 12px}
.cpdb-hero h1{font-size:clamp(1.6rem,4.2vw,2.25rem);line-height:1.15;margin:0 0 6px}
.cpdb-lede{color:var(--ink-soft);max-width:62ch;margin:0 0 10px;font-size:.98rem;line-height:1.55}
.cpdb-meta{display:flex;flex-wrap:wrap;gap:6px 16px;list-style:none;padding:0;margin:0;color:var(--ink-soft);font-size:.86rem;font-weight:600}
.cpdb-meta i{color:var(--leaf-dark);margin-right:6px}

/* passport card */
.cpdb-card{background:#fff;border-radius:var(--r-card);box-shadow:var(--shadow);overflow:hidden;margin-bottom:24px}
.cpdb-cover{background:var(--leaf-dark);color:#fff;display:flex;flex-wrap:wrap;align-items:center;gap:12px 14px;padding:16px 20px}
.cpdb-crest{flex:0 0 auto;width:46px;height:46px;border-radius:50%;border:2px dashed rgba(255,255,255,.9);display:grid;place-items:center;font-size:1.05rem;background:rgba(255,255,255,.08)}
.cpdb-cover-text{flex:1 1 160px;min-width:0}
.cpdb .cpdb-cover h1,.cpdb .cpdb-cover h2{color:#fff;font-size:1.15rem;line-height:1.25;margin:0}
.cpdb .cpdb-cover h1{font-size:1.4rem}
.cpdb-cover p{margin:2px 0 0;font-size:.86rem;color:#e2f2e8}
.cpdb-cover-action{margin-left:auto}
.cpdb-seam{border-top:1.5px dashed var(--line);margin:12px 20px 0}
.cpdb-body{padding:16px 20px 20px}
.cpdb-stitch{border:0;border-top:1.5px dashed var(--line);opacity:1;margin:20px 0}

/* buttons */
.cpdb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 18px;border-radius:var(--r-ctl);border:1.5px solid transparent;font-weight:800;font-size:.95rem;line-height:1.2;cursor:pointer;text-decoration:none;text-align:center;transition:transform .12s ease,box-shadow .12s ease,background-color .15s ease,border-color .15s ease}
.cpdb-btn:disabled{opacity:.55;cursor:not-allowed}
.cpdb-btn-primary{background:var(--leaf-dark);color:#fff;box-shadow:0 4px 0 var(--leaf-deep);margin-bottom:4px}
.cpdb-btn-primary:hover:not(:disabled){background:#135c32;color:#fff}
.cpdb-btn-primary:active:not(:disabled){transform:translateY(4px);box-shadow:0 0 0 var(--leaf-deep)}
.cpdb-btn-secondary{background:#fff;color:var(--leaf-dark);border-color:var(--line)}
.cpdb-btn-secondary:hover:not(:disabled){border-color:var(--leaf);background:var(--tint);color:var(--leaf-dark)}
.cpdb-btn-on-cover{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.6)}
.cpdb-btn-on-cover:hover:not(:disabled){background:rgba(255,255,255,.22);color:#fff}
.cpdb-btn-sm{min-height:38px;padding:6px 12px;font-size:.86rem}
.cpdb-btn-lg{min-height:54px;font-size:1.02rem}
.cpdb-btn-block{width:100%}
.cpdb-link{color:var(--leaf-dark);font-weight:700;text-decoration:underline;text-underline-offset:3px}
.cpdb-link:hover{color:var(--leaf-deep)}
.cpdb-icon-btn{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;border:0;background:transparent;color:var(--ink-soft);cursor:pointer}
.cpdb-icon-btn:hover{background:var(--tint);color:var(--ink)}

/* fields */
.cpdb-label{display:block;font-weight:700;font-size:.88rem;margin-bottom:6px;color:var(--ink)}
.cpdb-control{position:relative}
.cpdb-control > i{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--ink-soft);pointer-events:none;font-size:.92rem}
.cpdb-input{width:100%;min-height:46px;padding:10px 14px 10px 40px;border:1.5px solid var(--line);border-radius:var(--r-ctl);background:#fff;color:var(--ink);font-size:1rem;font-weight:600;appearance:none;-webkit-appearance:none;transition:border-color .15s,box-shadow .15s}
.cpdb-input::placeholder{color:#7d8f85;font-weight:500}
.cpdb .cpdb-input:focus,.cpdb .cpdb-input:focus-visible{outline:none;border-color:var(--leaf);box-shadow:0 0 0 4px rgba(31,138,76,.28)}
.cpdb-input[aria-invalid="true"]{border-color:var(--danger)}
.cpdb-input:disabled{background:var(--tint);color:var(--ink-soft)}
.cpdb-select{padding-right:40px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%235b6e63' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;background-size:12px}
.cpdb-hint{font-size:.82rem;color:var(--ink-soft);margin:6px 0 0;line-height:1.45}
.cpdb-section-label{font-weight:800;font-size:.92rem;margin:0 0 6px;color:var(--ink)}

/* segmented control */
.cpdb-seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;padding:4px;background:var(--tint);border:1.5px solid var(--line);border-radius:999px}
.cpdb-seg button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:6px 12px;border:0;border-radius:999px;background:transparent;color:var(--ink-soft);font-weight:700;font-size:.88rem;cursor:pointer;white-space:nowrap;transition:background-color .15s,color .15s}
.cpdb-seg button:hover{color:var(--ink)}
.cpdb-seg button[aria-selected="true"],.cpdb-seg button[aria-pressed="true"]{background:var(--leaf-dark);color:#fff;box-shadow:0 2px 0 var(--leaf-deep)}
.cpdb-seg-count{font-size:.75rem;font-weight:800;opacity:.85}
.cpdb-seg--sm button{min-height:34px;font-size:.8rem;padding:4px 10px}

/* notices */
.cpdb-notice{display:flex;align-items:flex-start;gap:10px;padding:12px 12px 12px 16px;border-radius:16px;border:1.5px solid;margin-bottom:20px;font-weight:600;font-size:.93rem;line-height:1.45}
.cpdb-notice > i{margin-top:3px}
.cpdb-notice p{margin:0;flex:1;min-width:0;overflow-wrap:anywhere}
.cpdb-notice--success{background:#eaf7ef;border-color:#a9d9bb;color:#134d2c}
.cpdb-notice--danger{background:var(--danger-bg);border-color:#f2b8b5;color:var(--danger-ink)}
.cpdb-notice--info{background:#e9f2fb;border-color:#b6d3ef;color:#123f66}
.cpdb-notice .cpdb-icon-btn{color:inherit;margin:-4px 0}
.cpdb-error{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:var(--danger-bg);color:var(--danger-ink);border-radius:12px;padding:10px 12px;margin-top:12px;font-size:.88rem;font-weight:600}
.cpdb-error .cpdb-link{color:var(--danger-ink)}

/* tiles */
.cpdb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:10px;list-style:none;padding:0;margin:0}
.cpdb-tile{position:relative;border:1.5px solid var(--line);border-radius:18px;background:#fff;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
.cpdb-tile:hover{transform:translateY(-2px);box-shadow:var(--shadow);border-color:#b2cbbb}
.cpdb-tile.is-active{border-color:var(--leaf-dark);background:#edf7f1;box-shadow:inset 0 0 0 1.5px var(--leaf-dark)}
.cpdb-tile-main{display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;height:100%;padding:16px 8px 12px;border:0;background:transparent;border-radius:inherit;color:var(--ink);cursor:pointer;text-align:center}
.cpdb-tile-img{width:48px;height:48px;object-fit:contain}
.cpdb-tile-img--round{border-radius:50%;border:1.5px solid var(--line);background:#fff}
.cpdb-tile-name{display:block;max-width:100%;font-weight:700;font-size:.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cpdb-tile-sub{font-size:.76rem;color:var(--ink-soft)}
.cpdb-count{font-size:.72rem;font-weight:800;background:var(--leaf-dark);color:#fff;border-radius:999px;padding:2px 8px}
.cpdb-fav{position:absolute;top:4px;right:4px}
.cpdb-fav[aria-pressed="true"]{color:var(--star)}
.cpdb-empty{text-align:center;padding:36px 12px;color:var(--ink-soft)}
.cpdb-empty > i{display:block;font-size:1.8rem;color:#9db3a6;margin-bottom:10px}
.cpdb-empty strong{display:block;color:var(--ink);margin-bottom:4px;font-size:1rem}
.cpdb-empty p{margin:0 auto;max-width:40ch;font-size:.9rem}
.cpdb-pager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px;padding-top:14px;border-top:1.5px dashed var(--line)}
.cpdb-pager > span{font-size:.86rem;color:var(--ink-soft);font-weight:700}

/* boarding pass */
.cpdb-pass{border:1.5px dashed var(--line);border-radius:20px;padding:14px 16px;background:#fbfdfc}
.cpdb-pass-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
.cpdb-pass-label{font-size:.82rem;color:var(--ink-soft);font-weight:700;margin:0}
.cpdb-island-name{font-size:1.2rem;margin:0;line-height:1.2;overflow-wrap:anywhere}
.cpdb-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:800;font-size:1.6rem;letter-spacing:.12em;color:var(--leaf-dark)}
.cpdb-pass-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:12px;border-top:1.5px dashed var(--line);font-size:.86rem;color:var(--ink-soft)}
.cpdb-chip{display:inline-flex;align-items:center;gap:6px;font-size:.8rem;font-weight:700;border-radius:999px;padding:4px 10px;border:1.5px solid}
.cpdb-chip--ok{background:#eaf7ef;color:#134d2c;border-color:#a9d9bb}
.cpdb-chip--warn{background:var(--warn-bg);color:var(--warn-ink);border-color:#efcf86}
.cpdb-check{display:inline-flex;align-items:center;gap:8px;font-weight:700;color:var(--ink);cursor:pointer;margin:0}
.cpdb-check input{width:20px;height:20px;accent-color:var(--leaf-dark);cursor:pointer}

/* presets & pocket */
.cpdb-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.cpdb-preset{display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:6px 8px;border:1.5px solid var(--line);border-radius:var(--r-ctl);background:#fff;color:var(--ink);font-weight:700;font-size:.84rem;cursor:pointer;transition:transform .15s ease,border-color .15s ease}
.cpdb-preset:hover{transform:translateY(-1px);border-color:var(--leaf)}
.cpdb-preset img{width:20px;height:20px;object-fit:contain}
.cpdb-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;list-style:none;padding:0;margin:0}
.cpdb-slot{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:116px;padding:12px 6px 8px;border:1.5px solid var(--line);border-radius:16px;background:#fff;text-align:center;min-width:0}
.cpdb-slot img{width:40px;height:40px;object-fit:contain}
.cpdb-slot--empty{border-style:dashed;background:var(--tint);color:#a9bdb1;font-size:1.1rem}
.cpdb-slot .cpdb-icon-btn{position:absolute;top:2px;right:2px;width:30px;height:30px}
.cpdb-stepper{display:flex;align-items:center;gap:6px}
.cpdb-stepper button{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;border:1.5px solid var(--line);background:#fff;color:var(--ink);font-weight:800;line-height:1;cursor:pointer}
.cpdb-stepper button:hover:not(:disabled){border-color:var(--leaf)}
.cpdb-stepper button:disabled{opacity:.45;cursor:not-allowed}
.cpdb-qty{font-weight:800;font-size:.84rem;color:var(--leaf-dark);min-width:2.2ch}
.cpdb-command{background:var(--tint);border:1.5px solid var(--line);border-radius:var(--r-ctl);padding:12px 14px}
.cpdb-command code{display:block;font-size:.85rem;color:var(--ink);white-space:pre-wrap;word-break:break-word}
.cpdb-meter{height:8px;border-radius:999px;background:#e2ece6;overflow:hidden;margin:8px 0 10px}
.cpdb-meter > span{display:block;height:100%;background:var(--leaf);transition:width .3s ease}
.cpdb-meter.is-full > span{background:var(--leaf-dark)}
.cpdb-meter.is-over > span{background:var(--danger)}

/* sign-in */
.cpdb-features{list-style:none;padding:0;margin:0 0 24px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.cpdb-features li{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--line);border-radius:var(--r-ctl);font-weight:700;font-size:.88rem}
.cpdb-features i{color:var(--leaf-dark);width:18px;text-align:center}
.cpdb-alt-links{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 20px;font-size:.9rem}

/* responsive */
@media (max-width:480px){
  .cpdb-presets{grid-template-columns:repeat(2,1fr)}
  .cpdb-features{grid-template-columns:1fr}
}
@media (max-width:420px){
  .cpdb-seg--stack{border-radius:20px}
  .cpdb-seg--stack button{flex-direction:column;gap:2px;border-radius:16px;font-size:.78rem;padding:6px 4px}
  .cpdb-cover{padding:14px 16px}
  .cpdb-seam{margin:10px 16px 0}
  .cpdb-body{padding:14px 16px 16px}
  .cpdb-crest{width:40px;height:40px;font-size:.95rem}
  .cpdb-grid{grid-template-columns:repeat(2,1fr)}
  .cpdb-code{font-size:1.35rem}
}

/* motion */
@media (prefers-reduced-motion: reduce){
  .cpdb *,.cpdb *::before,.cpdb *::after{transition:none!important;animation-duration:.01ms!important;animation-iteration-count:1!important}
  .cpdb-tile:hover,.cpdb-preset:hover,.cpdb-btn-primary:active:not(:disabled){transform:none}
}
`;

export const DropBot: React.FC = () => {
    const [searchParams] = useSearchParams();
    const urlIsland = searchParams.get('island');
    const urlTab = searchParams.get('tab');

    const { user, loading: authLoading, login } = useAuth();
    const { islands, loading: islandsLoading } = useIslandData();
    const { hasSavedCharacters } = useSavedCharacters();
    const [showSubRulesModal, setShowSubRulesModal] = useState(false);
    const [showSanrioModal, setShowSanrioModal] = useState(false);
    const [sanrioModalVillager, setSanrioModalVillager] = useState<string | null>(null);
    const [pendingDodoIsland, setPendingDodoIsland] = useState<IslandData | null>(null);
    const [revealPopupError, setRevealPopupError] = useState<string | null>(null);
    const { data: catalogData, isLoading: catalogLoading } = useCatalogData();
    const { favorites, isFavorite, toggleFavorite } = useFavorites();

    const {
        dropItems,
        setDropItems,
        totalDropCount,
        canIncreaseDrop,
        decreaseDropQuantity,
        increaseDropQuantity,
        removeDropItem,
        addItemToDropPockets,
        dropCommandText,
        getDropPocketQuantity,
    } = useCommandBuilderPockets();

    // ── Left Column Navigation Tab ──
    const [activeTab, setActiveTab] = useState<'items' | 'favorites' | 'villagers'>('items');

    // ── Search & Filter State ──
    const [itemSearch, setItemSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [itemPage, setItemPage] = useState(1);
    const ITEMS_PER_PAGE = 24;

    const [villagerSearch, setVillagerSearch] = useState('');
    const [villagerPage, setVillagerPage] = useState(1);
    const VILLAGERS_PER_PAGE = 24;

    // ── Villager Injection State ──
    const [selectedVillager, setSelectedVillager] = useState<CatalogEntity | null>(null);
    const [activePlot, setActivePlot] = useState<number>(0);
    const [injectedHouses, setInjectedHouses] = useState<Record<number, CatalogEntity | null>>({
        ...EMPTY_HOUSES,
    });
    const [injectingPlot, setInjectingPlot] = useState<number | null>(null);
    const [isBatchInjecting, setIsBatchInjecting] = useState(false);

    // ── Quick Variant Modal State ──
    const [variantModalItem, setVariantModalItem] = useState<PocketItem | null>(null);

    // ── Destination Island State ──
    const [dropFilter, setDropFilter] = useState<'all' | 'unlocked'>('all');
    const [selectedDropIsland, setSelectedDropIsland] = useState<IslandData | null>(null);
    const [dropDodoCode, setDropDodoCode] = useState<string | null>(null);
    const [dropDodoLoading, setDropDodoLoading] = useState(false);
    const [dropDodoError, setDropDodoError] = useState<string | null>(null);
    const [alreadyOnIsland, setAlreadyOnIsland] = useState(false);
    const [isDropping, setIsDropping] = useState(false);
    const [dodoCopied, setDodoCopied] = useState(false);

    // ── Notice State ──
    const [submissionNotice, setSubmissionNotice] = useState<{
        type: 'success' | 'danger' | 'info';
        message: string;
    } | null>(null);

    const playSound = () => {
        try {
            playChimeClick();
        } catch {
            // Audio synthesizer fallback
        }
    };

    // Drop bot is exclusively for VIP Sub Member islands
    const subMemberIslands = useMemo(() => {
        return islands.filter(
            (i) => i.cat === 'member' || i.type?.toLowerCase().includes('sub') || i.type === 'VIP'
        );
    }, [islands]);

    // Check if user has permission for an island
    const canAccessIsland = (island?: IslandData | null) => {
        if (!island) return false;
        if (user?.is_admin || user?.is_mod) return true;
        if (!island.requiredRoles || island.requiredRoles.length === 0) {
            return Boolean(user?.is_subscriber || user?.sub_tier);
        }
        if (!user || !user.roles) return false;
        return island.requiredRoles.some((role) => user.roles.includes(role));
    };

    const unlockedIslands = useMemo(() => {
        return subMemberIslands.filter((i) => canAccessIsland(i));
    }, [subMemberIslands, user]);

    const availableDropIslands = useMemo(() => {
        if (dropFilter === 'unlocked') return unlockedIslands;
        return subMemberIslands;
    }, [subMemberIslands, unlockedIslands, dropFilter]);

    // FIX: keep the selected island in the dropdown even when the
    // "My pass" filter hides it, so the <select> never shows a blank value.
    const islandOptions = useMemo(() => {
        if (
            selectedDropIsland &&
            !availableDropIslands.some((i) => i.id === selectedDropIsland.id)
        ) {
            return [selectedDropIsland, ...availableDropIslands];
        }
        return availableDropIslands;
    }, [availableDropIslands, selectedDropIsland]);

    // Handle URL query parameters (?island=...&tab=...)
    useEffect(() => {
        if (urlTab === 'villagers' || urlTab === 'items' || urlTab === 'favorites') {
            setActiveTab(urlTab);
        }
    }, [urlTab]);

    // FIX: resolve the ?island= match once so the auto-select effect below
    // can stand down instead of overwriting it in the same commit.
    const urlMatchedIsland = useMemo(() => {
        if (!urlIsland || subMemberIslands.length === 0) return null;
        const clean = urlIsland.trim().toLowerCase();
        return (
            subMemberIslands.find(
                (i) =>
                    i.name.toLowerCase() === clean ||
                    i.id.toLowerCase() === clean ||
                    (i.canonicalName && i.canonicalName.toLowerCase() === clean)
            ) || null
        );
    }, [urlIsland, subMemberIslands]);
    const urlMatchedIslandId = urlMatchedIsland?.id;

    useEffect(() => {
        if (urlMatchedIsland) {
            setSelectedDropIsland(urlMatchedIsland);
            if (urlMatchedIsland.dodoCode && urlMatchedIsland.dodoCode !== 'SUB ONLY' && urlMatchedIsland.dodoCode !== '.....') {
                setDropDodoCode(urlMatchedIsland.dodoCode);
            }
        }
        // Keyed on id so an island-list refresh doesn't undo the user's own choice.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlMatchedIslandId]);

    // Auto-select first accessible island (only when the URL didn't pick one)
    useEffect(() => {
        if (!selectedDropIsland && !urlMatchedIsland && subMemberIslands.length > 0) {
            const firstAccessible =
                subMemberIslands.find((i) => canAccessIsland(i)) ||
                subMemberIslands[0];
            setSelectedDropIsland(firstAccessible);
            if (firstAccessible?.dodoCode && firstAccessible.dodoCode !== 'SUB ONLY' && firstAccessible.dodoCode !== '.....') {
                setDropDodoCode(firstAccessible.dodoCode);
            }
        }
    }, [subMemberIslands, selectedDropIsland, urlMatchedIsland]);

    // Update Dodo if island has explicit public dodo
    useEffect(() => {
        if (selectedDropIsland) {
            if (selectedDropIsland.dodoCode && selectedDropIsland.dodoCode !== 'SUB ONLY' && selectedDropIsland.dodoCode !== '.....') {
                setDropDodoCode(selectedDropIsland.dodoCode);
            } else {
                setDropDodoCode(null);
            }
            setDropDodoError(null);
        }
    }, [selectedDropIsland]);

    // FIX: the "Copied" timer is now cleared on unmount / re-copy.
    useEffect(() => {
        if (!dodoCopied) return;
        const t = window.setTimeout(() => setDodoCopied(false), 2000);
        return () => window.clearTimeout(t);
    }, [dodoCopied]);

    // ── Catalog Data Extraction ──
    const allItems = useMemo(
        () => (catalogData?.items || []).filter((it) => !it.unorderable),
        [catalogData?.items]
    );
    const allVillagers = useMemo(
        () => (catalogData?.villagers || []).filter((v) => !v.unorderable),
        [catalogData?.villagers]
    );
    const villagerIdSet = useMemo(() => new Set(allVillagers.map((v) => v.id)), [allVillagers]);

    // Item Categories
    const itemCategories = useMemo(() => {
        const cats = new Set<string>();
        allItems.forEach((it) => {
            if (it.category) cats.add(it.category);
        });
        return ['All', ...Array.from(cats).sort()];
    }, [allItems]);

    // Filtered Items
    const filteredItems = useMemo(() => {
        let list = allItems;
        if (selectedCategory !== 'All') {
            list = list.filter((it) => it.category === selectedCategory);
        }
        if (itemSearch.trim()) {
            const q = itemSearch.toLowerCase().trim();
            list = list.filter((it) => it.name.toLowerCase().includes(q));
        }
        return list;
    }, [allItems, selectedCategory, itemSearch]);

    // Filtered Villagers
    const filteredVillagers = useMemo(() => {
        if (!villagerSearch.trim()) return allVillagers;
        const q = villagerSearch.toLowerCase().trim();
        return allVillagers.filter(
            (v) =>
                v.name.toLowerCase().includes(q) ||
                (v.category && v.category.toLowerCase().includes(q))
        );
    }, [allVillagers, villagerSearch]);

    // Filtered Favorites
    // FIX: unorderable entries are excluded here too, matching the catalog tabs.
    const favoriteItems = useMemo(() => {
        if (!favorites || favorites.length === 0) return [];
        const favSet = new Set(favorites);
        return (catalogData?.all || []).filter((it) => favSet.has(it.id) && !it.unorderable);
    }, [favorites, catalogData?.all]);

    // Paginated Items
    const totalItemPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
    const paginatedItems = useMemo(() => {
        const start = (itemPage - 1) * ITEMS_PER_PAGE;
        return filteredItems.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredItems, itemPage]);

    // Paginated Villagers
    const totalVillagerPages = Math.ceil(filteredVillagers.length / VILLAGERS_PER_PAGE) || 1;
    const paginatedVillagers = useMemo(() => {
        const start = (villagerPage - 1) * VILLAGERS_PER_PAGE;
        return filteredVillagers.slice(start, start + VILLAGERS_PER_PAGE);
    }, [filteredVillagers, villagerPage]);

    // FIX: clamp pages if the list shrinks (e.g. catalog refresh) so we never
    // land on an empty "Page 5 of 3".
    useEffect(() => {
        if (itemPage > totalItemPages) setItemPage(totalItemPages);
    }, [itemPage, totalItemPages]);
    useEffect(() => {
        if (villagerPage > totalVillagerPages) setVillagerPage(totalVillagerPages);
    }, [villagerPage, totalVillagerPages]);

    // ── Handlers ──
    const handleGetDodo = async (island: IslandData | null) => {
        if (!island) return;

        // Require saved in-game character before revealing Dodo codes
        if (!hasSavedCharacters) {
            setRevealPopupError('Save your in-game character (IGN and island name) in Profile settings, then come back to reveal Dodo codes.');
            return;
        }

        // Require one-time Sub Rules acknowledgment for Sub members / Sub islands
        const isSubMember = Boolean(user?.is_subscriber || user?.sub_tier || island.cat === 'member');
        if (isSubMember && !isSubRulesAccepted(user?.user_id)) {
            setPendingDodoIsland(island);
            setShowSubRulesModal(true);
            return;
        }

        setDropDodoLoading(true);
        setDropDodoError(null);
        playSound();

        try {
            const res = await revealIslandDodoCode(island.name);
            if (res.success && res.dodoCode) {
                setDropDodoCode(res.dodoCode);
                triggerConfetti({ theme: 'gold', particleCount: 70 });
                setSubmissionNotice({
                    type: 'success',
                    message: `Dodo code for ${island.name} is ${res.dodoCode}. Head to the airport to fly.`,
                });
            } else {
                const errMsg = res.error || 'We couldn’t get the Dodo code. Try again in a moment.';
                setDropDodoError(errMsg);
                if ((res as any).requires_character || /character|ign|island name/i.test(errMsg)) {
                    setRevealPopupError(errMsg);
                }
            }
        } catch (e: any) {
            console.error(e);
            setDropDodoError('Network error while getting the Dodo code. Check your connection and try again.');
        } finally {
            setDropDodoLoading(false);
        }
    };

    const handleSubRulesAccepted = () => {
        setShowSubRulesModal(false);
        if (pendingDodoIsland) {
            const target = pendingDodoIsland;
            setPendingDodoIsland(null);
            handleGetDodo(target);
        }
    };

    const handleCopyDodoCode = async () => {
        if (!dropDodoCode) return;
        playSound();
        const ok = await copyText(dropDodoCode);
        if (!ok) {
            setSubmissionNotice({
                type: 'danger',
                message: `Couldn’t copy automatically. Select ${dropDodoCode} and copy it by hand.`,
            });
            return;
        }
        setDodoCopied(true);
        setSubmissionNotice({
            type: 'info',
            message: `Copied Dodo code ${dropDodoCode}.`,
        });
    };

    // ── Direct Drop Items via SysBot HTTP API ──
    const handleDirectDrop = async () => {
        if (!selectedDropIsland) {
            setSubmissionNotice({
                type: 'danger',
                message: 'Pick a destination island first.',
            });
            return;
        }

        if (totalDropCount === 0 || !dropCommandText) {
            setSubmissionNotice({
                type: 'danger',
                message: `Your drop pocket is empty. Add up to ${DROP_MAX} items from the catalog or use a quick fill.`,
            });
            return;
        }

        // FIX: block over-limit drops instead of sending them to the bot.
        if (totalDropCount > DROP_MAX) {
            const extra = totalDropCount - DROP_MAX;
            setSubmissionNotice({
                type: 'danger',
                message: `Your pocket is over the ${DROP_MAX}-slot limit. Remove ${extra} item${extra !== 1 ? 's' : ''} and try again.`,
            });
            return;
        }

        playSound();
        setIsDropping(true);
        setSubmissionNotice(null);

        // Strip !drop command prefix
        const itemsClean = dropCommandText.replace(/^!drop\s*/i, '').trim();

        try {
            const res = await submitIslandDrop(
                selectedDropIsland.name,
                itemsClean,
                'items',
                user?.username || 'WebUser'
            );

            if (res.success) {
                triggerConfetti({ theme: 'rainbow', particleCount: 85 });
                playSound();
                setSubmissionNotice({
                    type: 'success',
                    message: `Dropping ${totalDropCount} item${totalDropCount !== 1 ? 's' : ''} on ${selectedDropIsland.name}. Look for them near the airport.`,
                });
            } else {
                setSubmissionNotice({
                    type: 'danger',
                    message: `The drop bot said: ${res.error || 'the drop failed'}. Check your pocket and try again.`,
                });
            }
        } catch (err: any) {
            setSubmissionNotice({
                type: 'danger',
                message: `Couldn’t reach the island bot (${err?.message || 'connection error'}). Wait a moment and try again.`,
            });
        } finally {
            setIsDropping(false);
        }
    };

    // ── Direct Inject Single Villager ──
    const handleDirectInjectVillager = async (plot: number, villager: CatalogEntity) => {
        if (isSanrioVillager(villager.name)) {
            setSanrioModalVillager(villager.name);
            setShowSanrioModal(true);
            return;
        }
        if (!selectedDropIsland) {
            setSubmissionNotice({
                type: 'danger',
                message: 'Pick a destination island first.',
            });
            return;
        }

        playSound();
        setInjectingPlot(plot);

        try {
            const res = await injectIslandVillager(selectedDropIsland.name, villager.name, plot);
            if (res.success) {
                triggerConfetti({ theme: 'gold', particleCount: 60 });
                playSound();
                setInjectedHouses((prev) => ({ ...prev, [plot]: villager }));
                setSubmissionNotice({
                    type: 'success',
                    message: `${villager.name} is moving into house plot ${plot} on ${selectedDropIsland.name}.`,
                });
            } else {
                setSubmissionNotice({
                    type: 'danger',
                    message: `The island bot said: ${res.error || 'the move-in failed'}. Try another plot or try again.`,
                });
            }
        } catch (err: any) {
            setSubmissionNotice({
                type: 'danger',
                message: `Couldn’t move the villager in (${err?.message || 'connection error'}). Try again in a moment.`,
            });
        } finally {
            setInjectingPlot(null);
        }
    };

    // ── Direct Batch Inject Villagers ──
    const handleDirectBatchInject = async (command: string) => {
        if (!selectedDropIsland) {
            setSubmissionNotice({
                type: 'danger',
                message: 'Pick a destination island first.',
            });
            return;
        }

        playSound();
        setIsBatchInjecting(true);

        try {
            const res = await batchInjectIslandVillagers(selectedDropIsland.name, command);
            if (res.success) {
                triggerConfetti({ theme: 'rainbow', particleCount: 90 });
                playSound();
                setSubmissionNotice({
                    type: 'success',
                    message: `Villagers are moving into their plots on ${selectedDropIsland.name}.`,
                });
            } else {
                setSubmissionNotice({
                    type: 'danger',
                    message: `The island bot said: ${res.error || 'the batch move-in failed'}. Check your plot list and try again.`,
                });
            }
        } catch (err: any) {
            setSubmissionNotice({
                type: 'danger',
                message: `Couldn’t move the villagers in (${err?.message || 'connection error'}). Try again in a moment.`,
            });
        } finally {
            setIsBatchInjecting(false);
        }
    };

    const handleApplyPreset = (fillType: string) => {
        playSound();
        if (fillType === 'tickets') {
            setDropItems([
                {
                    item: {
                        id: '16DB',
                        name: 'Nook Miles Ticket',
                        entityType: 'item',
                        category: 'Currency',
                        theme: 'Buffer',
                        series: 'Buffer',
                        interactivity: 'Consumable',
                        colour: 'Various',
                        image: 'https://dodo.ac/np/images/4/43/Nook_Miles_Ticket_NH_Inv_Icon.png',
                        description: 'Nook Miles Ticket',
                    },
                    quantity: 9,
                },
            ]);
        } else if (fillType === 'crowns') {
            setDropItems([
                {
                    item: {
                        id: '14BB',
                        name: 'Royal Crown',
                        entityType: 'item',
                        category: 'Currency',
                        theme: 'Buffer',
                        series: 'Buffer',
                        interactivity: 'Consumable',
                        colour: 'Various',
                        image: 'https://dodo.ac/np/images/c/c7/Royal_Crown_NH_Storage_Icon.png',
                        description: 'Royal Crown',
                    },
                    quantity: 9,
                },
            ]);
        } else if (fillType === 'bells') {
            setDropItems([
                {
                    item: {
                        id: '08A4',
                        name: '99,000 Bells',
                        entityType: 'item',
                        category: 'Currency',
                        theme: 'Buffer',
                        series: 'Buffer',
                        interactivity: 'Consumable',
                        colour: 'Various',
                        image: 'https://dodo.ac/np/images/1/1e/99k_Bells_NH_Inv_Icon.png',
                        description: '99k Bells',
                    },
                    quantity: 9,
                },
            ]);
        } else if (fillType === 'gold') {
            setDropItems([
                {
                    item: {
                        id: '0B07',
                        name: 'Gold nugget',
                        entityType: 'item',
                        category: 'Material',
                        theme: 'Buffer',
                        series: 'Buffer',
                        interactivity: 'Consumable',
                        colour: 'Gold',
                        image: 'https://dodo.ac/np/images/2/26/Gold_Nugget_NH_Inv_Icon.png',
                        description: 'Gold nugget',
                    },
                    quantity: 9,
                },
            ]);
        }
    };

    const handleCopyCommand = async (command: string, label = 'command') => {
        if (!command) return;
        playSound();
        const ok = await copyText(command);
        setSubmissionNotice(
            ok
                ? { type: 'success', message: `Copied the ${label}.` }
                : { type: 'danger', message: `Couldn’t copy automatically. Select the ${label} and copy it by hand.` }
        );
    };

    // FIX: favorites can contain villagers; those now open the villager
    // picker instead of being pushed into the item drop pocket.
    const handleFavoriteActivate = (it: CatalogEntity) => {
        playSound();
        if (villagerIdSet.has(it.id)) {
            setSelectedVillager(it);
            setActiveTab('villagers');
            setSubmissionNotice({
                type: 'info',
                message: `Selected ${it.name}. Choose a house plot to move them in.`,
            });
        } else {
            addItemToDropPockets(it);
        }
    };

    const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const idx = TABS.findIndex((t) => t.key === activeTab);
        let next = -1;
        if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length;
        else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = TABS.length - 1;
        if (next < 0) return;
        e.preventDefault();
        const key = TABS[next].key;
        playSound();
        setActiveTab(key);
        document.getElementById(`cpdb-tab-${key}`)?.focus();
    };

    // ── Render helpers ──
    const renderLoading = (label: string) => (
        <div className="cpdb-empty" role="status">
            <span className="spinner-border text-success mb-2" aria-hidden="true" />
            <strong>{label}</strong>
        </div>
    );

    const renderPager = (
        page: number,
        total: number,
        setPage: React.Dispatch<React.SetStateAction<number>>,
        label: string
    ) =>
        total > 1 ? (
            <nav className="cpdb-pager" aria-label={label}>
                <button
                    type="button"
                    className="cpdb-btn cpdb-btn-secondary cpdb-btn-sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                    <i className="fa-solid fa-chevron-left" aria-hidden="true" />
                    Previous
                </button>
                <span aria-live="polite">
                    Page {page} of {total}
                </span>
                <button
                    type="button"
                    className="cpdb-btn cpdb-btn-secondary cpdb-btn-sm"
                    disabled={page === total}
                    onClick={() => setPage((p) => Math.min(total, p + 1))}
                >
                    Next
                    <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                </button>
            </nav>
        ) : null;

    const renderItemTile = (it: CatalogEntity, onActivate: () => void, isVillager = false) => {
        const quantity = isVillager ? 0 : getDropPocketQuantity(it.id);
        const fav = isFavorite(it.id);
        const actionLabel = isVillager
            ? `Select ${it.name} to move in`
            : `Add ${it.name} to drop pocket${quantity > 0 ? `, ${quantity} already in pocket` : ''}`;
        return (
            <li key={it.id} className="cpdb-tile">
                <button type="button" className="cpdb-tile-main" onClick={onActivate} aria-label={actionLabel}>
                    <img
                        src={it.image || FALLBACK_IMG}
                        alt=""
                        className={`cpdb-tile-img ${isVillager ? 'cpdb-tile-img--round' : ''}`}
                        loading="lazy"
                        onError={handleImgError}
                    />
                    <span className="cpdb-tile-name" title={it.name}>
                        {it.name}
                    </span>
                    {isVillager && <span className="cpdb-tile-sub">Villager</span>}
                    {quantity > 0 && (
                        <span className="cpdb-count" aria-hidden="true">
                            ×{quantity} in pocket
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    className="cpdb-icon-btn cpdb-fav"
                    aria-pressed={fav}
                    aria-label={`Favorite ${it.name}`}
                    onClick={() => {
                        playSound();
                        toggleFavorite(it.id);
                    }}
                >
                    <i className={`fa-star ${fav ? 'fa-solid' : 'fa-regular'}`} aria-hidden="true" />
                </button>
            </li>
        );
    };

    // ── Auth loading skeleton ──
    if (authLoading) {
        return (
            <div className="cpdb cpdb--center">
                <style>{STYLES}</style>
                <div className="cpdb-card px-4 py-5 text-center mx-3" role="status">
                    <span className="spinner-border text-success mb-3" aria-hidden="true" />
                    <p className="fw-bold mb-0" style={{ color: 'var(--ink-soft)' }}>
                        Checking your resident passport…
                    </p>
                </div>
            </div>
        );
    }

    // ── Resident Sign In Wall ──
    if (!user) {
        return (
            <div className="cpdb cpdb--center">
                <style>{STYLES}</style>
                <Helmet>
                    <title>Treasure Island Drop Bot · ChoPaeng</title>
                    <meta
                        name="description"
                        content="Sign in with ChoPaeng to access the Treasure Island Drop Bot and Villager Injector."
                    />
                </Helmet>
                <div className="container" style={{ maxWidth: 620 }}>
                    <PassportCard
                        id="cpdb-signin"
                        icon="fa-passport"
                        title="Treasure Island drop bot"
                        subtitle="Show your resident passport to board"
                        headingLevel={1}
                    >
                        <p className="cpdb-lede">
                            Sign in with your ChoPaeng account to pick a VIP sub island, reveal its Dodo code,
                            drop items on the ground and move villagers into house plots 0–9.
                        </p>

                        <ul className="cpdb-features">
                            <li>
                                <i className="fa-solid fa-parachute-box" aria-hidden="true" />
                                Drop up to {DROP_MAX} items at once
                            </li>
                            <li>
                                <i className="fa-solid fa-house-user" aria-hidden="true" />
                                Move villagers into plots 0–9
                            </li>
                            <li>
                                <i className="fa-solid fa-plane-departure" aria-hidden="true" />
                                Reveal live Dodo codes
                            </li>
                            <li>
                                <i className="fa-solid fa-bolt" aria-hidden="true" />
                                Send it all from your browser
                            </li>
                        </ul>

                        <button
                            id="dropbot-resident-login-btn"
                            type="button"
                            onClick={() => {
                                playSound();
                                login();
                            }}
                            className="cpdb-btn cpdb-btn-primary cpdb-btn-lg cpdb-btn-block"
                        >
                            <i className="fa-solid fa-passport" aria-hidden="true" />
                            Sign in with ChoPaeng
                        </button>

                        <hr className="cpdb-stitch" />

                        <nav className="cpdb-alt-links" aria-label="Other tools">
                            <Link to="/order" className="cpdb-link">
                                Use the 40-slot order bot instead
                            </Link>
                            <Link to="/membership" className="cpdb-link">
                                See sub member benefits
                            </Link>
                        </nav>
                    </PassportCard>
                </div>
            </div>
        );
    }

    const isCurrentIslandAccessible = canAccessIsland(selectedDropIsland);
    const isOverLimit = totalDropCount > DROP_MAX;
    const emptySlots = Math.max(0, DROP_MAX - totalDropCount);
    const dropDisabled = totalDropCount === 0 || isDropping || !selectedDropIsland || isOverLimit;
    const meterState = isOverLimit ? 'is-over' : totalDropCount === DROP_MAX ? 'is-full' : '';

    const catalogSubtitle =
        activeTab === 'items'
            ? 'Tap an item to add it to your drop pocket.'
            : activeTab === 'favorites'
                ? 'Your starred items and villagers, ready to go.'
                : 'Pick a villager, then choose a house plot.';

    return (
        <div className="cpdb">
            <style>{STYLES}</style>
            <Helmet>
                <title>Treasure Island Drop Bot &amp; Villager Injector | ChoPaeng</title>
                <meta
                    name="description"
                    content="Drop up to 9 custom items or inject villagers into House Plots 0–9 instantly on ChoPaeng Treasure Islands."
                />
            </Helmet>

            {/* ════ HERO ════ */}
            <header className="cpdb-hero">
                <div className="container">
                    <div className="d-flex align-items-end justify-content-between flex-wrap gap-3">
                        <div>
                            <h1 className="ac-font">Treasure Island drop bot</h1>
                            <p className="cpdb-lede">
                                Pick an island, reveal its Dodo code, then drop items at the airport or move villagers in,
                                all from your browser.
                            </p>
                            <ul className="cpdb-meta">
                                <li>
                                    <i className="fa-solid fa-parachute-box" aria-hidden="true" />
                                    Up to {DROP_MAX} slots per drop
                                </li>
                                <li>
                                    <i className="fa-solid fa-house-chimney" aria-hidden="true" />
                                    House plots 0–9
                                </li>
                            </ul>
                        </div>
                        <Link to="/order" className="cpdb-btn cpdb-btn-secondary">
                            <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                            Switch to the 40-slot order bot
                        </Link>
                    </div>
                </div>
            </header>

            {/* ════ MAIN ════ */}
            <main className="container pt-3">
                {/* Notice region stays mounted so screen readers announce changes */}
                <div aria-live="polite" aria-atomic="true">
                    {submissionNotice && (
                        <div
                            className={`cpdb-notice cpdb-notice--${submissionNotice.type}`}
                            role={submissionNotice.type === 'danger' ? 'alert' : 'status'}
                        >
                            <i
                                aria-hidden="true"
                                className={`fa-solid ${submissionNotice.type === 'success'
                                    ? 'fa-circle-check'
                                    : submissionNotice.type === 'danger'
                                        ? 'fa-triangle-exclamation'
                                        : 'fa-circle-info'
                                    }`}
                            />
                            <p>{submissionNotice.message}</p>
                            <button
                                type="button"
                                className="cpdb-icon-btn"
                                aria-label="Dismiss message"
                                onClick={() => setSubmissionNotice(null)}
                            >
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="row g-4">
                    {/* ══════════ LEFT: CATALOG ══════════ */}
                    <div className="col-12 col-lg-7">
                        <PassportCard id="cpdb-catalog" icon="fa-book-open" title="Nook catalog" subtitle={catalogSubtitle}>
                            <div
                                className="cpdb-seg cpdb-seg--stack mb-3"
                                role="tablist"
                                aria-label="Catalog sections"
                                onKeyDown={handleTabKeyDown}
                            >
                                {TABS.map((t) => {
                                    const selected = activeTab === t.key;
                                    return (
                                        <button
                                            key={t.key}
                                            id={`cpdb-tab-${t.key}`}
                                            type="button"
                                            role="tab"
                                            aria-selected={selected}
                                            aria-controls="cpdb-catalog-panel"
                                            tabIndex={selected ? 0 : -1}
                                            onClick={() => {
                                                playSound();
                                                setActiveTab(t.key);
                                            }}
                                        >
                                            <i className={`fa-solid ${t.icon}`} aria-hidden="true" />
                                            <span>
                                                {t.label}
                                                {t.key === 'favorites' && (
                                                    <span className="cpdb-seg-count"> ({favoriteItems.length})</span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div
                                id="cpdb-catalog-panel"
                                role="tabpanel"
                                aria-labelledby={`cpdb-tab-${activeTab}`}
                            >
                                {/* ── ITEMS ── */}
                                {activeTab === 'items' && (
                                    <>
                                        <div className="row g-3 mb-2">
                                            <div className="col-12 col-md-7">
                                                <label htmlFor="cpdb-item-search" className="cpdb-label">
                                                    Search items
                                                </label>
                                                <div className="cpdb-control">
                                                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                                                    <input
                                                        id="cpdb-item-search"
                                                        type="search"
                                                        autoComplete="off"
                                                        value={itemSearch}
                                                        onChange={(e) => {
                                                            setItemSearch(e.target.value);
                                                            setItemPage(1);
                                                        }}
                                                        placeholder="Furniture, materials, DIYs, clothes…"
                                                        className="cpdb-input"
                                                        aria-describedby="cpdb-item-count"
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-5">
                                                <label htmlFor="cpdb-item-category" className="cpdb-label">
                                                    Category
                                                </label>
                                                <div className="cpdb-control">
                                                    <i className="fa-solid fa-filter" aria-hidden="true" />
                                                    <select
                                                        id="cpdb-item-category"
                                                        value={selectedCategory}
                                                        onChange={(e) => {
                                                            setSelectedCategory(e.target.value);
                                                            setItemPage(1);
                                                        }}
                                                        className="cpdb-input cpdb-select"
                                                    >
                                                        {itemCategories.map((c) => (
                                                            <option key={c} value={c}>
                                                                {c}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {!catalogLoading && (
                                            <p id="cpdb-item-count" className="cpdb-hint mb-3" aria-live="polite">
                                                {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                                            </p>
                                        )}

                                        {catalogLoading ? (
                                            renderLoading('Loading the Nook catalog…')
                                        ) : paginatedItems.length === 0 ? (
                                            <div className="cpdb-empty">
                                                <i className="fa-solid fa-box-open" aria-hidden="true" />
                                                <strong>No items found</strong>
                                                <p>
                                                    {itemSearch.trim()
                                                        ? `Nothing matches “${itemSearch.trim()}”. Try a shorter name or set the category to All.`
                                                        : 'This category is empty. Pick another category.'}
                                                </p>
                                            </div>
                                        ) : (
                                            <ul className="cpdb-grid" role="list">
                                                {paginatedItems.map((it) =>
                                                    renderItemTile(it, () => {
                                                        playSound();
                                                        addItemToDropPockets(it);
                                                    })
                                                )}
                                            </ul>
                                        )}

                                        {renderPager(itemPage, totalItemPages, setItemPage, 'Item pages')}
                                    </>
                                )}

                                {/* ── FAVORITES ── */}
                                {activeTab === 'favorites' && (
                                    <>
                                        {catalogLoading ? (
                                            renderLoading('Loading your favorites…')
                                        ) : favoriteItems.length === 0 ? (
                                            <div className="cpdb-empty">
                                                <i className="fa-regular fa-star" aria-hidden="true" />
                                                <strong>No favorites yet</strong>
                                                <p>Tap the star on any item to keep it here for quick drops.</p>
                                            </div>
                                        ) : (
                                            <ul className="cpdb-grid" role="list">
                                                {favoriteItems.map((it) =>
                                                    renderItemTile(
                                                        it,
                                                        () => handleFavoriteActivate(it),
                                                        villagerIdSet.has(it.id)
                                                    )
                                                )}
                                            </ul>
                                        )}
                                    </>
                                )}

                                {/* ── VILLAGERS ── */}
                                {activeTab === 'villagers' && (
                                    <>
                                        <div className="mb-3">
                                            <label htmlFor="cpdb-villager-search" className="cpdb-label">
                                                Search villagers
                                            </label>
                                            <div className="cpdb-control">
                                                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                                                <input
                                                    id="cpdb-villager-search"
                                                    type="search"
                                                    autoComplete="off"
                                                    value={villagerSearch}
                                                    onChange={(e) => {
                                                        setVillagerSearch(e.target.value);
                                                        setVillagerPage(1);
                                                    }}
                                                    placeholder="Name or personality, e.g. Raymond or smug"
                                                    className="cpdb-input"
                                                    aria-describedby="cpdb-villager-hint"
                                                />
                                            </div>
                                            <p id="cpdb-villager-hint" className="cpdb-hint" aria-live="polite">
                                                {selectedVillager
                                                    ? `Selected ${selectedVillager.name}. Now choose a house plot.`
                                                    : 'Pick a villager, then choose a house plot.'}
                                            </p>
                                        </div>

                                        {catalogLoading ? (
                                            renderLoading('Loading villagers…')
                                        ) : paginatedVillagers.length === 0 ? (
                                            <div className="cpdb-empty">
                                                <i className="fa-solid fa-user-slash" aria-hidden="true" />
                                                <strong>No villagers found</strong>
                                                <p>
                                                    {villagerSearch.trim()
                                                        ? `Nothing matches “${villagerSearch.trim()}”. Check the spelling or search by personality.`
                                                        : 'The villager list is empty right now. Refresh the page to try again.'}
                                                </p>
                                            </div>
                                        ) : (
                                            <ul className="cpdb-grid" role="list">
                                                {paginatedVillagers.map((v) => {
                                                    const isChosen = selectedVillager?.id === v.id;
                                                    return (
                                                        <li key={v.id} className={`cpdb-tile ${isChosen ? 'is-active' : ''}`}>
                                                            <button
                                                                type="button"
                                                                className="cpdb-tile-main"
                                                                aria-pressed={isChosen}
                                                                aria-label={`Select ${v.name}${v.category ? `, ${v.category}` : ''}`}
                                                                onClick={() => {
                                                                    playSound();
                                                                    setSelectedVillager(v);
                                                                }}
                                                            >
                                                                <img
                                                                    src={v.image || FALLBACK_IMG}
                                                                    alt=""
                                                                    className="cpdb-tile-img cpdb-tile-img--round"
                                                                    loading="lazy"
                                                                    onError={handleImgError}
                                                                />
                                                                <span className="cpdb-tile-name">{v.name}</span>
                                                                {v.category && <span className="cpdb-tile-sub">{v.category}</span>}
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}

                                        {renderPager(villagerPage, totalVillagerPages, setVillagerPage, 'Villager pages')}
                                    </>
                                )}
                            </div>
                        </PassportCard>
                    </div>

                    {/* ══════════ RIGHT: ISLAND + POCKET ══════════ */}
                    <div className="col-12 col-lg-5">
                        <PassportCard
                            id="cpdb-island"
                            icon="fa-location-dot"
                            title="Destination island"
                            subtitle="Where your drop or villager will go"
                        >
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                <span className="cpdb-section-label mb-0" id="cpdb-filter-label">
                                    Show
                                </span>
                                <div className="cpdb-seg cpdb-seg--sm" role="group" aria-labelledby="cpdb-filter-label">
                                    <button
                                        type="button"
                                        aria-pressed={dropFilter === 'all'}
                                        onClick={() => {
                                            playSound();
                                            setDropFilter('all');
                                        }}
                                    >
                                        All islands ({subMemberIslands.length})
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={dropFilter === 'unlocked'}
                                        onClick={() => {
                                            playSound();
                                            setDropFilter('unlocked');
                                        }}
                                    >
                                        My pass ({unlockedIslands.length})
                                    </button>
                                </div>
                            </div>

                            <div className="mb-3">
                                <label htmlFor="cpdb-island-select" className="cpdb-label">
                                    Island
                                </label>
                                <div className="cpdb-control">
                                    <i className="fa-solid fa-umbrella-beach" aria-hidden="true" />
                                    <select
                                        id="cpdb-island-select"
                                        className="cpdb-input cpdb-select"
                                        value={selectedDropIsland?.id || ''}
                                        disabled={islandsLoading}
                                        aria-describedby="cpdb-island-hint"
                                        onChange={(e) => {
                                            const found = subMemberIslands.find((i) => i.id === e.target.value);
                                            setSelectedDropIsland(found || null);
                                            setAlreadyOnIsland(false);
                                            playSound();
                                        }}
                                    >
                                        {islandsLoading ? (
                                            <option value="">Loading islands…</option>
                                        ) : (
                                            <>
                                                <option value="">Choose a VIP sub island</option>
                                                {islandOptions.map((isl) => (
                                                    <option key={isl.id} value={isl.id}>
                                                        {isl.name}
                                                        {canAccessIsland(isl) ? '' : ' (sub pass needed)'}
                                                    </option>
                                                ))}
                                            </>
                                        )}
                                    </select>
                                </div>
                                <p id="cpdb-island-hint" className="cpdb-hint">
                                    {islandsLoading
                                        ? 'Fetching the island list.'
                                        : `${availableDropIslands.length} island${availableDropIslands.length !== 1 ? 's' : ''} in this list. Every one is a VIP sub island.`}
                                </p>
                            </div>

                            {selectedDropIsland && (
                                <div className="cpdb-pass">
                                    <div className="cpdb-pass-row mb-3">
                                        <div style={{ minWidth: 0 }}>
                                            <p className="cpdb-pass-label">Boarding pass for</p>
                                            <p className="cpdb-island-name ac-font">{selectedDropIsland.name}</p>
                                        </div>
                                        {isCurrentIslandAccessible ? (
                                            <span className="cpdb-chip cpdb-chip--ok">
                                                <i className="fa-solid fa-circle-check" aria-hidden="true" />
                                                You have access
                                            </span>
                                        ) : (
                                            <span className="cpdb-chip cpdb-chip--warn">
                                                <i className="fa-solid fa-lock" aria-hidden="true" />
                                                Sub pass needed
                                            </span>
                                        )}
                                    </div>

                                    <div className="cpdb-pass-row">
                                        <div>
                                            <p className="cpdb-pass-label">Dodo code</p>
                                            {dropDodoCode ? (
                                                <span className="cpdb-code">{dropDodoCode}</span>
                                            ) : (
                                                <p className="cpdb-hint mt-0">Hidden until you reveal it, to keep the island private.</p>
                                            )}
                                        </div>
                                        <div className="d-flex gap-2 flex-wrap">
                                            {dropDodoCode ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="cpdb-btn cpdb-btn-secondary cpdb-btn-sm"
                                                        onClick={handleCopyDodoCode}
                                                    >
                                                        <i className={`fa-solid ${dodoCopied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" />
                                                        {dodoCopied ? 'Copied' : 'Copy code'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="cpdb-btn cpdb-btn-secondary cpdb-btn-sm"
                                                        onClick={() => handleGetDodo(selectedDropIsland)}
                                                        disabled={dropDodoLoading}
                                                        aria-busy={dropDodoLoading}
                                                    >
                                                        <i className="fa-solid fa-arrows-rotate" aria-hidden="true" />
                                                        {dropDodoLoading ? 'Refreshing…' : 'Refresh code'}
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="cpdb-btn cpdb-btn-primary"
                                                    disabled={dropDodoLoading}
                                                    aria-busy={dropDodoLoading}
                                                    onClick={() => handleGetDodo(selectedDropIsland)}
                                                >
                                                    {dropDodoLoading ? (
                                                        <>
                                                            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                                                            Revealing…
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fa-solid fa-eye" aria-hidden="true" />
                                                            Reveal Dodo code
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="cpdb-pass-foot">
                                        <span>
                                            <i className="fa-solid fa-plane-departure me-2" aria-hidden="true" />
                                            Fly from Orville’s counter at the airport.
                                        </span>
                                        <label className="cpdb-check" htmlFor="cpdb-on-island">
                                            <input
                                                id="cpdb-on-island"
                                                type="checkbox"
                                                checked={alreadyOnIsland}
                                                onChange={() => {
                                                    playSound();
                                                    setAlreadyOnIsland(!alreadyOnIsland);
                                                }}
                                            />
                                            I’m on the island
                                        </label>
                                    </div>

                                    {!isCurrentIslandAccessible && (
                                        <p className="cpdb-hint">
                                            This island needs a sub pass.{' '}
                                            <Link to="/membership" className="cpdb-link">
                                                See sub member benefits
                                            </Link>
                                        </p>
                                    )}

                                    {dropDodoError && (
                                        <div className="cpdb-error" role="alert">
                                            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
                                            <span style={{ flex: 1, minWidth: 0 }}>{dropDodoError}</span>
                                            {dropDodoError.includes('Sub Member') && (
                                                <Link to="/membership" className="cpdb-link">
                                                    Get a sub pass
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </PassportCard>

                        {activeTab === 'villagers' ? (
                            <>
                                {selectedVillager && isSanrioVillager(selectedVillager.name) && (
                                    <div
                                        className="d-flex align-items-center justify-content-between p-3 rounded-4 mb-3 border shadow-2xs gap-3 flex-wrap"
                                        style={{ background: '#fdf2f8', borderColor: '#fbcfe8' }}
                                    >
                                        <div className="d-flex align-items-center gap-2">
                                            <span style={{ fontSize: '1.4rem' }}>🎀</span>
                                            <div>
                                                <strong className="text-dark d-block" style={{ fontSize: '0.9rem' }}>
                                                    Special Sanrio Villager: {selectedVillager.name}
                                                </strong>
                                                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                                                    Requires a 2-step swap technique before moving in.
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-sm rounded-pill fw-bold px-3 py-1 text-white shadow-2xs d-inline-flex align-items-center gap-1.5"
                                            style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)', border: 'none', fontSize: '0.8rem' }}
                                            onClick={() => {
                                                playSound();
                                                setSanrioModalVillager(selectedVillager.name);
                                                setShowSanrioModal(true);
                                            }}
                                        >
                                            <i className="fa-solid fa-wand-magic-sparkles" />
                                            <span>Open 2-Step Wizard</span>
                                        </button>
                                    </div>
                                )}
                                <div className="d-flex align-items-center justify-content-between mb-2 px-1">
                                    <span className="text-muted fw-bold" style={{ fontSize: '0.78rem' }}>
                                        House Plots (0–9)
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-sm rounded-pill px-2.5 py-0.5 fw-bold d-inline-flex align-items-center gap-1 border-0"
                                        style={{ background: '#fdf2f8', color: '#be185d', fontSize: '0.75rem' }}
                                        onClick={() => {
                                            playSound();
                                            setShowSanrioModal(true);
                                        }}
                                    >
                                        <span>🎀</span>
                                        <span>Sanrio / Amiibo Guide</span>
                                    </button>
                                </div>
                                <DropBotHouseGrid
                                selectedVillager={selectedVillager}
                                activePlot={activePlot}
                                onSelectPlot={(p) => setActivePlot(p)}
                                injectedHouses={injectedHouses}
                                onAssignVillagerToPlot={(p, v) => {
                                    setInjectedHouses((prev) => ({ ...prev, [p]: v }));
                                }}
                                onClearPlot={(p) => {
                                    setInjectedHouses((prev) => ({ ...prev, [p]: null }));
                                }}
                                onClearAllPlots={() => {
                                    setInjectedHouses({ ...EMPTY_HOUSES });
                                }}
                                onCopyCommand={handleCopyCommand}
                                targetIsland={selectedDropIsland}
                                onInjectVillagerNow={handleDirectInjectVillager}
                                onBatchInjectNow={handleDirectBatchInject}
                                injectingPlot={injectingPlot}
                                isBatchInjecting={isBatchInjecting}
                            />
                            </>
                        ) : (
                            <PassportCard
                                id="cpdb-pocket"
                                icon="fa-parachute-box"
                                title="Drop pocket"
                                subtitle={`${totalDropCount} of ${DROP_MAX} slots filled`}
                                action={
                                    totalDropCount > 0 ? (
                                        <button
                                            type="button"
                                            className="cpdb-btn cpdb-btn-on-cover cpdb-btn-sm"
                                            onClick={() => {
                                                playSound();
                                                setDropItems([]);
                                            }}
                                        >
                                            <i className="fa-solid fa-trash-can" aria-hidden="true" />
                                            Clear pocket
                                        </button>
                                    ) : undefined
                                }
                            >
                                <p className="cpdb-section-label" id="cpdb-presets-label">
                                    Quick fill
                                </p>
                                <p className="cpdb-hint mt-0 mb-2" id="cpdb-presets-hint">
                                    Each one fills 9 slots and replaces what’s in your pocket.
                                </p>
                                <div
                                    className="cpdb-presets"
                                    role="group"
                                    aria-labelledby="cpdb-presets-label"
                                    aria-describedby="cpdb-presets-hint"
                                >
                                    {DROP_PRESETS.map((preset) => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            className="cpdb-preset"
                                            onClick={() => handleApplyPreset(preset.fillType)}
                                            aria-label={`Fill pocket with 9 ${preset.name}`}
                                        >
                                            <img src={preset.icon} alt="" onError={handleImgError} />
                                            {preset.name}
                                        </button>
                                    ))}
                                </div>

                                <hr className="cpdb-stitch" />

                                <p className="cpdb-section-label">Your items</p>
                                {dropItems.length === 0 && (
                                    <p className="cpdb-hint mt-0 mb-2">
                                        Your pocket is empty. Pick items from the catalog or use a quick fill.
                                    </p>
                                )}
                                <ul className="cpdb-slots" role="list">
                                    {dropItems.map((entry) => (
                                        <li key={entry.item.id} className="cpdb-slot">
                                            <button
                                                type="button"
                                                className="cpdb-icon-btn"
                                                aria-label={`Remove ${entry.item.name} from pocket`}
                                                onClick={() => {
                                                    playSound();
                                                    removeDropItem(entry.item.id);
                                                }}
                                            >
                                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                                            </button>
                                            <img
                                                src={entry.item.image || FALLBACK_IMG}
                                                alt=""
                                                onError={handleImgError}
                                            />
                                            <span className="cpdb-tile-name" title={entry.item.name}>
                                                {entry.item.name}
                                            </span>
                                            <div
                                                className="cpdb-stepper"
                                                role="group"
                                                aria-label={`Quantity of ${entry.item.name}`}
                                            >
                                                <button
                                                    type="button"
                                                    aria-label={`Remove one ${entry.item.name}`}
                                                    onClick={() => {
                                                        playSound();
                                                        decreaseDropQuantity(entry.item.id);
                                                    }}
                                                >
                                                    <i className="fa-solid fa-minus fa-xs" aria-hidden="true" />
                                                </button>
                                                <span className="cpdb-qty">×{entry.quantity}</span>
                                                <button
                                                    type="button"
                                                    aria-label={`Add one ${entry.item.name}`}
                                                    disabled={!canIncreaseDrop}
                                                    onClick={() => {
                                                        playSound();
                                                        increaseDropQuantity(entry.item.id);
                                                    }}
                                                >
                                                    <i className="fa-solid fa-plus fa-xs" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                    {Array.from({ length: emptySlots }).map((_, i) => (
                                        <li key={`empty-${i}`} className="cpdb-slot cpdb-slot--empty" aria-hidden="true">
                                            <i className="fa-regular fa-square" />
                                        </li>
                                    ))}
                                </ul>

                                <div className="cpdb-command mt-3">
                                    <div className="d-flex align-items-center justify-content-between gap-2">
                                        <span className="cpdb-section-label mb-0" id="cpdb-cmd-label">
                                            Drop command
                                        </span>
                                        <span className="cpdb-hint m-0">
                                            {totalDropCount}/{DROP_MAX}
                                        </span>
                                    </div>
                                    <div
                                        className={`cpdb-meter ${meterState}`}
                                        role="progressbar"
                                        aria-label="Pocket slots used"
                                        aria-valuenow={totalDropCount}
                                        aria-valuemin={0}
                                        aria-valuemax={DROP_MAX}
                                        aria-valuetext={`${totalDropCount} of ${DROP_MAX} slots used`}
                                    >
                                        <span style={{ width: `${Math.min(100, (totalDropCount / DROP_MAX) * 100)}%` }} />
                                    </div>
                                    {isOverLimit && (
                                        <div className="cpdb-error mt-0 mb-2" role="alert">
                                            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                                            <span>
                                                Too many items. Remove {totalDropCount - DROP_MAX} item
                                                {totalDropCount - DROP_MAX !== 1 ? 's' : ''} to get back to {DROP_MAX}.
                                            </span>
                                        </div>
                                    )}
                                    <code aria-labelledby="cpdb-cmd-label">
                                        {dropCommandText || '!drop (add items to build the command)'}
                                    </code>
                                </div>

                                <div className="d-grid gap-2 mt-3">
                                    <button
                                        type="button"
                                        disabled={dropDisabled}
                                        aria-busy={isDropping}
                                        onClick={handleDirectDrop}
                                        className="cpdb-btn cpdb-btn-primary cpdb-btn-lg cpdb-btn-block"
                                    >
                                        {isDropping ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                                                Dropping on {selectedDropIsland?.name || 'island'}…
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-parachute-box" aria-hidden="true" />
                                                Drop {totalDropCount} item{totalDropCount !== 1 ? 's' : ''} on{' '}
                                                {selectedDropIsland?.name || 'island'}
                                            </>
                                        )}
                                    </button>
                                    {!selectedDropIsland && (
                                        <p className="cpdb-hint mt-0 text-center">Choose an island above to enable dropping.</p>
                                    )}
                                    <button
                                        type="button"
                                        disabled={totalDropCount === 0}
                                        onClick={() => handleCopyCommand(dropCommandText, 'drop command')}
                                        className="cpdb-btn cpdb-btn-secondary cpdb-btn-block"
                                    >
                                        <i className="fa-solid fa-copy" aria-hidden="true" />
                                        Copy drop command
                                    </button>
                                </div>
                            </PassportCard>
                        )}
                    </div>
                </div>
            </main>

            {/* Quick Variant Modal */}
            {variantModalItem && (
                <CommandBuilderVariantModal
                    item={variantModalItem}
                    isOpen={!!variantModalItem}
                    onClose={() => setVariantModalItem(null)}
                    onOpenFullDetail={() => { }}
                    showOrder={false}
                    mode="drop-only"
                    addItemToDropPockets={addItemToDropPockets}
                    decreaseDropQuantity={decreaseDropQuantity}
                    increaseDropQuantity={increaseDropQuantity}
                    totalDropCount={totalDropCount}
                    canIncreaseDrop={canIncreaseDrop}
                    getDropPocketQuantity={getDropPocketQuantity}
                    isFavorite={isFavorite(variantModalItem.id)}
                    onToggleFavorite={(id) => toggleFavorite(id)}
                />
            )}

            {/* Sanrio / Amiibo Guidance Modal */}
            <SanrioGuidanceModal
                isOpen={showSanrioModal}
                onClose={() => {
                    setShowSanrioModal(false);
                    setSanrioModalVillager(null);
                }}
                targetIslandName={selectedDropIsland?.name}
                initialVillagerName={sanrioModalVillager}
                onInjectSuccess={(villagerName, plot) => {
                    const foundVillager = allVillagers.find(
                        (v: CatalogEntity) => v.name.toLowerCase() === villagerName.toLowerCase()
                    );
                    if (foundVillager) {
                        setInjectedHouses((prev) => ({ ...prev, [plot]: foundVillager }));
                    }
                    setSubmissionNotice({
                        type: 'success',
                        message: `${villagerName} is moving into house plot ${plot} on ${selectedDropIsland?.name || 'the island'}.`,
                    });
                }}
            />

            {/* Sub Rules Modal (one-time only for Sub members) */}
            {showSubRulesModal && (
                <SubRulesModal
                    isOpen={showSubRulesModal}
                    onClose={() => {
                        setShowSubRulesModal(false);
                        setPendingDodoIsland(null);
                    }}
                    onAccept={handleSubRulesAccepted}
                />
            )}

            {/* Error popup with a Profile link if the character is missing */}
            {revealPopupError && (
                <RevealErrorPopup
                    message={revealPopupError}
                    onClose={() => setRevealPopupError(null)}
                />
            )}
        </div>
    );
};

export default DropBot;