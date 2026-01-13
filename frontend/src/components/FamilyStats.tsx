import React from 'react';
import { User, CheckCircle2, Wallet, ChevronRight, Star } from 'lucide-react';
import { motion } from 'framer-motion';

interface Member {
    id: number;
    name: string;
    telegramId: string;
    points: number;
    completedTasks: number;
    purchasesCount?: number;
}

interface FamilyStatsProps {
    members: Member[];
    onMemberClick: (id: string, name: string) => void;
}

const FamilyStats: React.FC<FamilyStatsProps> = ({ members, onMemberClick }) => {
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold px-1">Участники</h3>
            <div className="space-y-4">
                {members.length === 0 ? (
                    <div className="glass-card p-12 text-center text-gray-400 font-medium">Семья пока пуста</div>
                ) : members.map((member, idx) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={member.id}
                        onClick={() => onMemberClick(member.telegramId, member.name)}
                        className="glass-card p-5 flex items-center gap-4 hover:bg-white/60 transition-all active:scale-[0.98] cursor-pointer group"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center text-indigo-500 shadow-inner group-hover:from-indigo-100">
                            <User size={28} />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-800 text-lg">{member.name}</h4>
                            <div className="flex gap-3 mt-1">
                                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-tighter">
                                    <CheckCircle2 size={10} /> {member.completedTasks} Сделано
                                </span>
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-tighter">
                                    <Wallet size={10} /> {member.points} Баллов
                                </span>
                            </div>
                        </div>
                        <ChevronRight className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                    </motion.div>
                ))}
            </div>

            <div className="glass-card p-6 relative overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 border-white/60 shadow-xl">
                <div className="absolute -bottom-4 -right-4 p-4 opacity-20 rotate-12 text-indigo-500">
                    <Star size={120} />
                </div>
                <div className="relative z-10">
                    <h4 className="text-indigo-600/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Совет дня</h4>
                    <p className="text-lg font-bold leading-tight text-gray-900">Выполняйте задания вовремя, чтобы стать чемпионом недели!</p>
                </div>
            </div>
        </div>
    );
};

export default FamilyStats;
