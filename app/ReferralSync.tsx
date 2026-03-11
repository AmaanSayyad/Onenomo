'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';

function ReferralSyncInner() {
    const searchParams = useSearchParams();
    const { setReferredBy, fetchReferralInfo, address, isConnected } = useStore();



    useEffect(() => {
        if (isConnected && address) {
            useStore.getState().fetchProfile(address);
            useStore.getState().fetchRecentTrades(address);
        }
    }, [isConnected, address]);

    return null;
}

export function ReferralSync() {
    return (
        <Suspense fallback={null}>
            <ReferralSyncInner />
        </Suspense>
    );
}
