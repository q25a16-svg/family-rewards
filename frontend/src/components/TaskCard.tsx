import React from 'react';
import { Check, X, Trash2, Clock, Send, Loader2, User } from 'lucide-react';

interface Task {
    id: number;
    title: string;
    description: string;
    reward: number;
    status: 'active' | 'in_progress' | 'pending' | 'completed';
    assigneeId?: number | null;
    isGlobal: boolean;
}

interface TaskCardProps {
    task: Task;
    role: 'parent' | 'child';
    onAction: (id: number, action: string) => void;
    assigneeName?: string; // New prop
}

const TaskCard: React.FC<TaskCardProps> = ({ task, role, onAction, assigneeName }) => {
    const [loading, setLoading] = React.useState(false);
    const isPending = task.status === 'pending';
    const isInProgress = task.status === 'in_progress';

    const handleAction = async (action: string) => {
        setLoading(true);
        try {
            await onAction(task.id, action);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`glass-card p-5 group transition-all relative overflow-hidden ${isPending ? 'border-l-4 border-l-amber-500 bg-amber-50/40' :
            isInProgress ? 'border-l-4 border-l-indigo-500 bg-indigo-50/40' : ''
            } border-white/60 shadow-xl`}>

            <div className="flex justify-between items-start mb-3">
                <div className="space-y-1.5 w-[75%]">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-lg text-gray-800 leading-tight">{task.title}</h4>
                        {task.isGlobal ? (
                            <span className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-md shadow-sm">Всем</span>
                        ) : (
                            <span className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-md shadow-sm">Личное</span>
                        )}
                    </div>
                    <p className="text-gray-600 font-bold text-xs line-clamp-2 leading-relaxed opacity-90">{task.description}</p>
                </div>
                <div className="flex flex-col items-end">
                    <span className={`font-black text-3xl tracking-tighter ${isPending ? 'text-amber-600' : 'text-indigo-600 drop-shadow-sm'}`}>
                        +{task.reward}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Баллов</span>
                </div>
            </div>

            <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-2 flex-wrap">
                    {task.status === 'active' && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl bg-green-500/10 text-green-700 border border-green-500/20 shadow-sm">Доступно</span>
                    )}
                    {isInProgress && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl bg-indigo-100 text-indigo-700 flex items-center gap-1.5 border border-indigo-200">
                                <Clock size={12} strokeWidth={3} /> В работе
                            </span>
                            {assigneeName && role === 'parent' && (
                                <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                                    <User size={10} /> {assigneeName}
                                </span>
                            )}
                        </div>
                    )}
                    {isPending && (
                        <div className="flex flex-col gap-1 items-start">
                            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl bg-amber-100 text-amber-700 flex items-center gap-1.5 border border-amber-200">
                                <Loader2 size={12} className="animate-spin" strokeWidth={3} /> Проверка
                            </span>
                            {assigneeName && (
                                <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1 pl-1">
                                    от {assigneeName}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    {role === 'child' && (
                        <>
                            {task.status === 'active' && (
                                <button
                                    onClick={() => handleAction('take')}
                                    disabled={loading}
                                    className="bg-gradient-to-r from-indigo-500 to-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-indigo-500/30 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70 backdrop-blur-sm"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Взять'}
                                </button>
                            )}
                            {isInProgress && (
                                <button
                                    onClick={() => handleAction('submit')}
                                    disabled={loading}
                                    className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/30 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Готово</>}
                                </button>
                            )}
                        </>
                    )}

                    {role === 'parent' && (
                        <>
                            {isPending && (
                                <>
                                    <button
                                        onClick={() => handleAction('approve')}
                                        disabled={loading}
                                        className="bg-gradient-to-r from-green-400 to-emerald-600 text-white p-3 rounded-2xl shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:shadow-green-400/50 active:scale-90 disabled:opacity-50 transition-all border border-white/20"
                                    >
                                        {loading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} strokeWidth={4} />}
                                    </button>
                                    <button
                                        onClick={() => handleAction('reject')}
                                        disabled={loading}
                                        className="bg-gradient-to-r from-red-500 to-rose-600 text-white p-3 rounded-2xl shadow-[0_4px_12px_rgba(244,63,94,0.3)] hover:shadow-rose-400/50 active:scale-90 disabled:opacity-50 transition-all border border-white/20"
                                    >
                                        {loading ? <Loader2 size={20} className="animate-spin" /> : <X size={20} strokeWidth={4} />}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => handleAction('delete')}
                                disabled={loading}
                                className="text-gray-400 hover:text-red-500 transition-colors p-2.5 hover:bg-red-50/50 rounded-xl active:bg-red-100"
                            >
                                <Trash2 size={20} strokeWidth={2} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskCard;
