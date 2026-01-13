import React from 'react';
import { ShoppingBag, ChevronRight, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface ShopCardProps {
    item: {
        id: number;
        title: string;
        price: number;
        description?: string;
    };
    isParent: boolean;
    onBuy: (id: number) => void;
    onDelete: (id: number) => void;
}

const colors = [
    'from-pink-400 to-rose-500',
    'from-amber-400 to-orange-500',
    'from-emerald-400 to-teal-500',
    'from-sky-400 to-indigo-500',
    'from-violet-400 to-purple-500'
];

const ShopCard: React.FC<ShopCardProps> = ({ item, isParent, onBuy, onDelete }) => {
    const colorClass = colors[item.id % colors.length];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-4 flex flex-col relative group overflow-hidden"
        >
            {isParent && (
                <button
                    onClick={() => onDelete(item.id)}
                    className="absolute top-2 right-2 z-10 p-1.5 bg-red-100/80 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                >
                    <X size={14} />
                </button>
            )}

            <div className={`w-full aspect-square bg-gradient-to-br ${colorClass} rounded-2xl mb-3 flex items-center justify-center overflow-hidden border border-white/20 shadow-lg group-hover:scale-105 transition-transform duration-300`}>
                <ShoppingBag size={40} className="text-white/80 drop-shadow-md" />
            </div>

            <h4 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2 h-10 leading-tight">{item.title}</h4>

            <div className="flex items-center justify-between mt-auto">
                <span className="text-pink-600 font-extrabold flex items-center gap-1">
                    {item.price} <span className="text-xs">💎</span>
                </span>
                {!isParent && (
                    <button
                        onClick={() => onBuy(item.id)}
                        className="bg-pink-500/10 text-pink-600 p-2 rounded-lg hover:bg-pink-500 hover:text-white transition-all active:scale-90"
                    >
                        <ChevronRight size={18} />
                    </button>
                )}
            </div>
        </motion.div>
    );
};

export default ShopCard;
