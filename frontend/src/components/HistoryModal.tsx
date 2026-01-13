import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ShoppingBag, Clock, ArrowUpRight } from 'lucide-react';

interface HistoryModalProps {
    show: boolean;
    onClose: () => void;
    history: {
        tasks: any[];
        purchases: any[];
    } | null;
    userName: string;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ show, onClose, history, userName }) => {
    return (
        <AnimatePresence>
            {show && (
                <div className="fixed inset-0 z-[100] flex items-stretch justify-center p-0">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="w-full h-full relative z-10 flex flex-col md:max-w-md md:h-[92vh] md:my-auto md:rounded-[40px] overflow-hidden bg-gradient-to-br from-[#a8edea]/90 to-[#fed6e3]/90 backdrop-blur-3xl border-t border-white/50 shadow-2xl"
                    >
                        <header className="p-8 pb-6 border-b border-black/5 flex justify-between items-start sticky top-0 z-20">
                            <div>
                                <h3 className="text-3xl font-bold text-gray-900 tracking-tight leading-none">{userName}</h3>
                                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-[0.2em] mt-2 opacity-70">История активности</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-3 bg-white/40 text-gray-700 rounded-2xl hover:bg-white/60 transition-all hover:scale-110 active:scale-95 border border-white/40 shadow-sm"
                            >
                                <X size={24} strokeWidth={2.5} />
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-12">
                            {(!history?.tasks.length && !history?.purchases.length) ? (
                                <div className="py-24 text-center space-y-4">
                                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto blur-sm absolute left-1/2 -translate-x-1/2" />
                                    <Clock size={48} className="mx-auto text-gray-400 relative z-10 opacity-30" />
                                    <p className="text-gray-500 font-bold text-sm tracking-wide">Активности пока не зафиксировано</p>
                                </div>
                            ) : (
                                <>
                                    {/* Задания */}
                                    {history.tasks.length > 0 && (
                                        <section className="space-y-4">
                                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1 flex items-center justify-between">
                                                Выполненные задания
                                                <span className="bg-green-600 text-white px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm shadow-green-200">{history.tasks.length}</span>
                                            </h4>
                                            <div className="space-y-3">
                                                {history.tasks.map((task: any) => (
                                                    <div key={task.id} className="glass-card p-4 flex items-center gap-4 bg-white/30 border-white/40 shadow-sm transition-all hover:bg-white/50 group">
                                                        <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-700 flex items-center justify-center shrink-0 border border-green-200">
                                                            <CheckCircle2 size={24} strokeWidth={2.5} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start">
                                                                <p className="font-bold text-gray-900 text-sm leading-tight group-hover:text-black">{task.title}</p>
                                                                <span className="text-green-700 font-bold text-sm ml-2">+{task.reward}</span>
                                                            </div>
                                                            <p className="text-[10px] text-indigo-700/60 font-bold flex items-center gap-1 mt-1.5 uppercase tracking-tighter">
                                                                <Clock size={10} /> {new Date(task.updatedAt || Date.now()).toLocaleDateString('ru-RU')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {/* Покупки */}
                                    {history.purchases.length > 0 && (
                                        <section className="space-y-4">
                                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-1 flex items-center justify-between">
                                                Купленные награды
                                                <span className="bg-pink-600 text-white px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm shadow-pink-200">{history.purchases.length}</span>
                                            </h4>
                                            <div className="space-y-3">
                                                {history.purchases.map((p: any) => (
                                                    <div key={p.id} className="glass-card p-4 flex items-center gap-4 bg-white/30 border-white/40 shadow-sm transition-all hover:bg-white/50 group">
                                                        <div className="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-700 flex items-center justify-center shrink-0 border border-pink-200">
                                                            <ShoppingBag size={24} strokeWidth={2.5} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start">
                                                                <p className="font-bold text-gray-900 text-sm leading-tight group-hover:text-black">{p.item?.title || 'Товар'}</p>
                                                                <span className="text-pink-700 font-bold text-sm ml-2">-{p.item?.price} 💎</span>
                                                            </div>
                                                            <p className="text-[10px] text-pink-700/60 font-bold flex items-center gap-1 mt-1.5 uppercase tracking-tighter">
                                                                <Clock size={10} /> {new Date(p.createdAt || Date.now()).toLocaleDateString('ru-RU')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default HistoryModal;
