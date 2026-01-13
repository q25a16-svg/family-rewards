import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { X } from 'lucide-react';

interface ModalProps {
    show: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ show, onClose, title, children }) => (
    <AnimatePresence>
        {show && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/20 backdrop-blur-xl transition-all duration-500"
                />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="glass-card w-full max-w-[420px] bg-white/90 relative z-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] flex flex-col max-h-[90vh] overflow-hidden rounded-[40px] border border-white/60"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center px-8 py-7 sticky top-0 bg-white/40 backdrop-blur-md z-20 border-b border-black/5">
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h3>
                        <button
                            onClick={onClose}
                            className="p-3 rounded-2xl bg-black/5 text-gray-500 hover:bg-black/10 transition-all hover:rotate-90 active:scale-90"
                        >
                            <X size={24} strokeWidth={2.5} />
                        </button>
                    </div>
                    <div className="p-8 pt-6 overflow-y-auto custom-scrollbar flex-1">
                        {children}
                    </div>
                </motion.div>
            </div>
        )}
    </AnimatePresence>
);

export default Modal;
