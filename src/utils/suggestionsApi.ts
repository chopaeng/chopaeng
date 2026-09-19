import type {
    SuggestionFormData,
    SuggestionSendResult,
} from '../types/suggestion';
import { DODO_API_BASE } from '../config/api';
import { getAuthToken } from '../context/authToken';

const LAST_SUBMIT_KEY = 'chopaeng_last_suggestion_timestamp';
const COOLDOWN_SECONDS = 15;

/**
 * Checks remaining cooldown in seconds (if any).
 */
export const getSuggestionCooldownRemaining = (): number => {
    try {
        const last = localStorage.getItem(LAST_SUBMIT_KEY);
        if (!last) return 0;
        const elapsed = (Date.now() - parseInt(last, 10)) / 1000;
        if (elapsed < COOLDOWN_SECONDS) {
            return Math.ceil(COOLDOWN_SECONDS - elapsed);
        }
    } catch {
        // Ignore localStorage error
    }
    return 0;
};

/**
 * Dispatches a resident suggestion securely through ChoBot backend (/api/suggestions).
 * No Discord webhook URLs are exposed on the client side.
 */
export const sendDiscordSuggestion = async (
    data: SuggestionFormData
): Promise<SuggestionSendResult> => {
    const cooldown = getSuggestionCooldownRemaining();
    if (cooldown > 0) {
        return {
            success: false,
            error: `Please wait ${cooldown}s before submitting another suggestion.`,
            cooldownSeconds: cooldown,
        };
    }

    try {
        const token = getAuthToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${DODO_API_BASE}/api/suggestions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                title: data.title.trim(),
                description: data.description.trim(),
                discordUsername: data.discordUsername?.trim() || undefined,
                inGameName: data.inGameName?.trim() || undefined,
                islandName: data.islandName?.trim() || undefined,
                pageUrl: data.pageUrl || window.location.href,
            }),
        });

        const resData = await response.json().catch(() => null);

        if (response.ok && resData?.success !== false) {
            try {
                localStorage.setItem(LAST_SUBMIT_KEY, Date.now().toString());
            } catch {
                // Ignore
            }
            return { success: true };
        } else {
            return {
                success: false,
                error: resData?.error || `Server returned error status ${response.status}`,
                cooldownSeconds: resData?.cooldownSeconds,
            };
        }
    } catch (err: any) {
        console.error('Error submitting suggestion to ChoBot API:', err);
        return {
            success: false,
            error: err?.message || 'Could not connect to suggestion service. Please check your connection.',
        };
    }
};

/**
 * Triggers opening the global suggestion modal.
 */
export const openSuggestionModal = () => {
    window.dispatchEvent(new CustomEvent('chopaeng_open_suggestions'));
};
