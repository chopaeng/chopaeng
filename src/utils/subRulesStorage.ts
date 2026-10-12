/**
 * Sub Member Rules & Guidelines storage, helpers, and verification.
 * Enforces one-time acknowledgement for Sub members.
 */
import { getActiveUserId, getUserScopedItem, setUserScopedItem } from './accountStorage';
import { getAuthToken } from '../context/authToken';
import { API_BASE } from '../config/api';

export const SUB_RULES_KEY = 'chopaeng_sub_rules_accepted_v1';

export interface SubRuleItem {
    id: string;
    number: number;
    tag: string;
    title: string;
    description: string;
    icon: string;
    highlight?: string;
}

export const SUB_RULES_LIST: SubRuleItem[] = [
    {
        id: 'c1',
        number: 1,
        tag: ':c1_:',
        title: 'Do Not Share the Dodo Code',
        description:
            'Do not share the Dodo Code with anyone. The Dodo Code is a unique code that allows people to visit our island. It is to be kept strictly confidential. There will be No sharing the code with anyone including your other account, friends, family, or online acquaintances. You are only allowed 1 Character/Island per membership.',
        icon: 'fa-shield-halved',
        highlight: '1 Character/Island per membership',
    },
    {
        id: 'c2',
        number: 2,
        tag: ':c2_:',
        title: 'Server Nickname Format',
        description:
            'Change your nickname in this server to match the following format: ACNH Character Name | Your ACNH Island Name. This will help us to identify you and your island more easily. You can change your nickname in the 👑┋set-nick channel.',
        icon: 'fa-id-badge',
        highlight: 'Format: ACNH Character Name | Your ACNH Island Name',
    },
    {
        id: 'c3',
        number: 3,
        tag: ':c3_:',
        title: 'Always Leave Via Airport & No AFK!',
        description:
            'Always leave via the airport. And NO AFK!. Do not use the "-" button to leave the island. Leaving via the airport will ensure that your progress is saved. If you use the "-" button, your progress may not be saved, and you may lose items or progress.',
        icon: 'fa-plane-departure',
        highlight: 'Never leave via "-" button & No AFK',
    },
    {
        id: 'c4',
        number: 4,
        tag: ':c4_:',
        title: 'Internet Connection: NAT Type A or B Required',
        description:
            'Check your Internet Connection before flying in. Must be NAT Type A or B. These NAT Types are required for smooth online play.\n\nIf you have NAT Type C or D, you may experience connection problems, so please do not join our islands if this is the case.',
        icon: 'fa-wifi',
        highlight: 'Must be NAT Type A or B',
    },
    {
        id: 'c5',
        number: 5,
        tag: ':c5_:',
        title: 'Check Pinned Channels Before Asking',
        description:
            'Check/Read the pinned section on each channel before asking any questions. Most likely you will find your answer here. The pinned section in each channel contains important information, such as rules, tutorials, and announcements. Before asking a question, please take a look at the pinned section to see if your answer is already there.',
        icon: 'fa-thumbtack',
        highlight: 'Check pinned info before asking',
    },
    {
        id: 'c6',
        number: 6,
        tag: ':c6_:',
        title: 'Do Not Litter on the Islands',
        description:
            'Do not litter on the islands! We have trash bins all over the place. Litter can be unsightly and can affect the island refreshing its items. If you have anything that you do not want, please dispose of it in a trash bin.',
        icon: 'fa-trash-can',
        highlight: 'Dispose of unwanted items in trash bins',
    },
    {
        id: 'c7',
        number: 7,
        tag: ':c7_:',
        title: 'Tutorials for @ChoBot (Drop Bot)',
        description:
            'Tutorials for @ChoBot (our drop bot) can be found on the 🍄┋chobot-how. @ChoBot is a bot that can be used to drop items on islands. If you need help using our bot, please check out the tutorials in the 🍄┋chobot-how channel.',
        icon: 'fa-robot',
        highlight: 'Guides in 🍄┋chobot-how',
    },
    {
        id: 'c8',
        number: 8,
        tag: ':c8_:',
        title: 'Only Request @ChoBot While on the Island',
        description:
            'Do not request any item using @ChoBot unless you are already on the island. And make sure to pick up all the items you have requested. Please make sure that you are on the island and that you are able to pick up the item before requesting it.',
        icon: 'fa-box-open',
        highlight: 'Must be on island before requesting',
    },
];

/**
 * Checks if the current user has already accepted the Sub Rules (one time only).
 */
export const isSubRulesAccepted = (userId?: string | null): boolean => {
    try {
        const uid = userId || getActiveUserId();
        if (!uid) return false;
        const val = getUserScopedItem(SUB_RULES_KEY, uid);
        return val === 'true';
    } catch {
        return false;
    }
};

/**
 * Marks the Sub Rules as accepted locally and persists to backend database.
 */
export const markSubRulesAccepted = async (userId?: string | null): Promise<void> => {
    const uid = userId || getActiveUserId();
    if (uid) {
        setUserScopedItem(SUB_RULES_KEY, 'true', uid);
    }
    window.dispatchEvent(
        new CustomEvent('chopaeng_sub_rules_updated', {
            detail: { accepted: true, userId: uid },
        })
    );

    const token = getAuthToken();
    if (token) {
        try {
            await fetch(`${API_BASE}/api/user/sub-rules`, {
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
 * Synchronizes sub rules acceptance status from backend.
 */
export const syncSubRulesFromDb = async (userId?: string | null): Promise<boolean> => {
    const token = getAuthToken();
    const uid = userId || getActiveUserId();
    if (!token || !uid) return false;

    try {
        const res = await fetch(`${API_BASE}/api/user/sub-rules`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            if (data.accepted) {
                setUserScopedItem(SUB_RULES_KEY, 'true', uid);
                return true;
            }
        }
    } catch {
        // network error fallback ignored
    }
    return false;
};
