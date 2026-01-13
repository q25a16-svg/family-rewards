import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import React from 'react';

export const ToastContainer: React.FC = () => {
    const { toasts, removeToast } = useStore();

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
            <AnimatePresence initial={false}>
                {toasts.map(toast => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: -50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        layout
                        className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl backdrop-blur-md border ${toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white shadow-red-500/20' :
                                toast.type === 'success' ? 'bg-green-500/90 border-green-400 text-white shadow-green-500/20' :
                                    'bg-white/90 border-white/40 text-gray-800 shadow-gray-200/50'
                            }`}
                    >
                        <div className="mt-0.5 shrink-0">
                            {toast.type === 'error' && <AlertCircle size={20} />}
                            {toast.type === 'success' && <CheckCircle2 size={20} />}
                            {toast.type === 'info' && <Info size={20} className="text-blue-500" />}
                        </div>
                        <p className="flex-1 text-sm font-bold leading-tight drop-shadow-sm">{toast.message}</p>
                        <button onClick={() => removeToast(toast.id)} className="opacity-70 hover:opacity-100 shrink-0">
                            <X size={18} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
