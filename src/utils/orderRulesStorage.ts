/**
 * Order Bot Rules & Guidelines storage, helpers, and verification.
 * Enforces one-time acknowledgement for Order Bot users.
 */
import { getActiveUserId, getUserScopedItem, setUserScopedItem } from './accountStorage';
import { getAuthToken } from '../context/authToken';
import { API_BASE } from '../config/api';

export const ORDER_RULES_KEY = 'chopaeng_order_rules_accepted_v1';

export interface OrderRuleItem {
    id: string;
    number: number;
    tag: string;
    title: string;
    description: string;
    icon: string;
    highlight?: string;
}

export const ORDER_RULES_LIST: OrderRuleItem[] = [
    {
        id: 'c1',
        number: 1,
        tag: ':c1_:',
        title: 'Set Server Nickname Before Ordering',
        description:
            'You MUST change your server nickname to: Your ACNH Character Name | Your ACNH Island Name before using the orderbot. You can change your nickname on your website Profile or in the set-nick channel.',
        icon: 'fa-id-badge',
        highlight: 'Format: Your ACNH Character Name | Your ACNH Island Name',
    },
    {
        id: 'c2',
        number: 2,
        tag: ':c2_:',
        title: 'DO NOT Share the Dodo Code',
        description:
            'DO NOT share the code to a different person. This might get you a permanent ban on the bot. Only you who placed the order can go to the island.',
        icon: 'fa-shield-halved',
        highlight: 'Only the order placer may fly in',
    },
    {
        id: 'c3',
        number: 3,
        tag: ':c3_:',
        title: 'DO NOT Litter on the Island',
        description:
            'DO NOT litter on the island. Just pick up what you need. If you drop unwanted items, it may break subsequent orders.',
        icon: 'fa-trash-can',
        highlight: 'Never litter on the island',
    },
    {
        id: 'c4',
        number: 4,
        tag: ':c4_:',
        title: 'Order Only What You Need',
        description:
            'Order only what you need. Be considerate of other members waiting in queue.',
        icon: 'fa-box-open',
        highlight: 'Order only what you need',
    },
    {
        id: 'c5',
        number: 5,
        tag: ':c5_:',
        title: 'Reliable Internet Connection (NAT A or B)',
        description:
            'Make sure you have a good internet connection. Must be at least 15-25 Mbps with NAT Type A or B to avoid crashing the island session.',
        icon: 'fa-wifi',
        highlight: 'Must be at least 15-25 Mbps & NAT A/B',
    },
    {
        id: 'c6',
        number: 6,
        tag: ':c6_:',
        title: 'Always Leave Via Airport & No AFK',
        description:
            'Always leave via the airport. NEVER use the "-" button or sleep your console. Leaving via "-" can roll back saves and disrupt everyone.',
        icon: 'fa-plane-departure',
        highlight: 'Always leave through DAL airport gates',
    },
    {
        id: 'c7',
        number: 7,
        tag: ':c7_:',
        title: 'Fly Only When Ready',
        description:
            'Only fly when the bot displays your Dodo code and your order status is READY. Do not attempt to fly while items are still being dropped.',
        icon: 'fa-paper-plane',
        highlight: 'Wait for status READY',
    },
    {
        id: 'c8',
        number: 8,
        tag: ':c8_:',
        title: 'Empty Pockets Before Flying',
        description:
            'Make sure you have completely empty pockets before flying into the order island so you can pick up all your ordered items in one trip.',
        icon: 'fa-briefcase',
        highlight: 'Fly with empty pockets',
    },
];

/**
 * Checks if the current user has already accepted the Order Rules.
 */
export const isOrderRulesAccepted = (userId?: string | null): boolean => {
    try {
        const uid = userId || getActiveUserId();
        if (!uid) return false;
        const val = getUserScopedItem(ORDER_RULES_KEY, uid);
        return val === 'true';
    } catch {
        return false;
    }
};

/**
 * Marks the Order Rules as accepted locally and persists to backend database & Discord role.
 */
export const markOrderRulesAccepted = async (userId?: string | null): Promise<void> => {
    const uid = userId || getActiveUserId();
    if (uid) {
        setUserScopedItem(ORDER_RULES_KEY, 'true', uid);
    }
    window.dispatchEvent(
        new CustomEvent('chopaeng_order_rules_updated', {
            detail: { accepted: true, userId: uid },
        })
    );

    const token = getAuthToken();
    if (token) {
        try {
            await fetch(`${API_BASE}/api/user/order-rules`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
            });
        } catch {
            // Server sync fallback ignored
        }
    }
};

/**
 * Synchronizes order rules acceptance status from backend.
 */
export const syncOrderRulesFromDb = async (userId?: string | null): Promise<boolean> => {
    const token = getAuthToken();
    const uid = userId || getActiveUserId();
    if (!token || !uid) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/order-rules`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            if (data.accepted) {
                setUserScopedItem(ORDER_RULES_KEY, 'true', uid);
                return true;
            }
        }
    } catch {
        // network error fallback ignored
    }
    return false;
};
