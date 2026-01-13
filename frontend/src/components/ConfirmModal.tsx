import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
    show: boolean;
    onClose: () => void;
    onConfirm?: () => void; // Legacy
    title: string;
    message: string;
    confirmText?: string;
    confirmColor?: string;
    // New Actions API
    actions?: {
        text: string;
        className?: string;
        onClick: () => void;
    }[];
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    show, onClose, onConfirm, title, message,
    confirmText = 'Удалить',
    confirmColor = 'bg-red-500',
    actions
}) => (
    <AnimatePresence>
        {show && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/40 backdrop-blur-md"
                />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="glass-card w-full max-w-xs bg-white p-6 relative z-10 shadow-2xl text-center"
                >
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                        <AlertTriangle className="text-red-500" size={32} />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-gray-900">{title}</h3>
                    <p className="text-gray-500 text-sm mb-6">{message}</p>

                    <div className="flex gap-3 justify-center">
                        {actions ? (
                            actions.map((action, i) => (
                                <button
                                    key={i}
                                    onClick={action.onClick}
                                    className={`flex-1 px-4 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform ${action.className || 'bg-gray-100'}`}
                                >
                                    {action.text}
                                </button>
                            ))
                        ) : (
                            <>
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={() => { onConfirm?.(); onClose(); }}
                                    className={`flex-1 px-4 py-3 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-transform ${confirmColor}`}
                                >
                                    {confirmText}
                                </button>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        )}
    </AnimatePresence>
);

export default ConfirmModal;
