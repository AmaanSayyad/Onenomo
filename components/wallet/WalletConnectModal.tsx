'use client';

import React from 'react';
import { useBynomoStore } from '@/lib/store';
import { usePrivy } from '@privy-io/react-auth';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Mail } from 'lucide-react';
import { ConnectModal } from '@mysten/dapp-kit';

export const WalletConnectModal: React.FC = () => {
    const [isSuiWalletModalOpen, setIsSuiWalletModalOpen] = React.useState(false);
    const isOpen = useBynomoStore(state => state.isConnectModalOpen);
    const setOpen = useBynomoStore(state => state.setConnectModalOpen);
    const setPreferredNetwork = useBynomoStore(state => state.setPreferredNetwork);

    const { login: loginPrivy } = usePrivy();
    const isPrivyEnabled = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim());

    const handlePrivyConnect = () => {
        if (!isPrivyEnabled) {
            console.warn('Privy login is disabled. Set NEXT_PUBLIC_PRIVY_APP_ID to enable social login.');
            return;
        }

        setPreferredNetwork('OCT');
        loginPrivy();
        setOpen(false);
    };

    const handleOneChainConnect = () => {
        setPreferredNetwork('OCT');
        setOpen(false);
        setIsSuiWalletModalOpen(true);
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setOpen(false)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md max-h-[90vh] bg-[#0f0f0f] border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                >
                    {/* Header */}
                    <div className="p-5 sm:p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-transparent shrink-0">
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Connect Wallet</h2>
                            <p className="text-[11px] sm:text-sm text-gray-400 mt-1">Select your preferred network</p>
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                        >
                            <X className="w-5 h-5 text-gray-500 group-hover:text-white" />
                        </button>
                    </div>

                    {/* Options */}
                    <div className="p-4 sm:p-6 space-y-2 sm:space-y-3 overflow-y-auto no-scrollbar">
                        {/* OneChain wallet option */}
                        <button
                            onClick={handleOneChainConnect}
                            className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform shrink-0">
                                <img src="/logos/ctc-logo.png" alt="OCT" className="w-6 h-6 sm:w-7 sm:h-7 rounded-sm" />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-sm sm:text-base">OneChain Testnet</span>
                                    <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] bg-purple-500/20 text-purple-400 font-bold uppercase tracking-wider">OCT</span>
                                </div>
                                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">OneWallet, Sui Wallet, Suiet, Ethos</p>
                            </div>
                            <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 group-hover:text-purple-400 transition-colors" />
                        </button>

                        {/* Privy Social Option */}
                        {isPrivyEnabled && (
                            <button
                                onClick={handlePrivyConnect}
                                className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform shrink-0">
                                    <Mail className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400" />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white text-sm sm:text-base">Social Login</span>
                                        <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] bg-purple-500/20 text-purple-400 font-bold uppercase tracking-wider">Email</span>
                                    </div>
                                    <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                                        Google, Twitter, Email, etc.
                                    </p>
                                </div>
                                <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 group-hover:text-purple-400 transition-colors" />
                            </button>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-white/5 text-center shrink-0">
                        <p className="text-[8px] sm:text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                            BYNOMO Protocol · Pyth Hermes
                        </p>
                        <p className="text-[9px] text-gray-600 mt-1">Powered by Pyth Hermes · BYNOMO Protocol</p>
                    </div>
                </motion.div>
            </div>}
            </AnimatePresence>
            <ConnectModal
                trigger={<button type="button" aria-hidden="true" className="hidden" tabIndex={-1} />}
                open={isSuiWalletModalOpen}
                onOpenChange={setIsSuiWalletModalOpen}
            />
        </>
    );
};
