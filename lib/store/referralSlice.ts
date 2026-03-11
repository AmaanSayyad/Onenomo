import { StateCreator } from 'zustand';
import { supabase } from '../supabase/client';

export interface ReferralState {
    referralCode: string | null;
    referredBy: string | null;
    referralCount: number;
    referralLeaderboard: any[];
    isLoadingReferrals: boolean;

    setReferredBy: (code: string) => void;
    fetchReferralInfo: (address: string) => Promise<void>;
    createReferralCode: (address: string) => Promise<string>;
    fetchReferralLeaderboard: () => Promise<void>;
}

export const createReferralSlice: StateCreator<ReferralState> = (set, get) => ({
    referralCode: null,
    referredBy: typeof window !== 'undefined' ? localStorage.getItem('referred_by') : null,
    referralCount: 0,
    referralLeaderboard: [],
    isLoadingReferrals: false,

    setReferredBy: (code: string) => {
        if (code && !get().referredBy) {
            localStorage.setItem('referred_by', code);
            set({ referredBy: code });
        }
    },

    fetchReferralInfo: async (address: string) => {
        // Disabled as per user request (not using referrals)
        return;
    },

    createReferralCode: async (address: string) => {
        // Disabled as per user request
        return '';
    },

    fetchReferralLeaderboard: async () => {
        // Disabled as per user request
        return;
    }
});
