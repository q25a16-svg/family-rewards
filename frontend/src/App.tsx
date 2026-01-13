import React, { useEffect, useState } from 'react';
import { LayoutGrid, ShoppingBag, User, CheckCircle2, ChevronRight, Star, Wallet, Loader2, X, Trash2, ShieldCheck, Globe, UserPlus, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from './store';

declare global {
    interface Window {
        Telegram: {
            WebApp: any;
        };
    }
}

import Modal from './components/Modal';
import TaskCard from './components/TaskCard';
import ShopCard from './components/ShopCard';
import FamilyStats from './components/FamilyStats';
import ConfirmModal from './components/ConfirmModal';
import HistoryModal from './components/HistoryModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ToastContainer';

const colorMap: Record<string, string> = {
    blue: 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]',
    green: 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]',
    pink: 'bg-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)]',
    purple: 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]',
};

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [taskSubTab, setTaskSubTab] = useState('active'); // for parent: active/review, for child: personal/global
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showShopModal, setShowShopModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [shopSubTab, setShopSubTab] = useState('catalog'); // catalog or orders
    const [selectedMember, setSelectedMember] = useState<{ id: string, name: string } | null>(null);
    const [confirmConfig, setConfirmConfig] = useState<any>(null);
    const [formData, setFormData] = useState<any>({ isGlobal: true });

    const {
        user, tasks, shopItems, familyStats, familyMembers, userHistory, loading, pendingPurchases,
        fetchUser, fetchTasks, fetchShop, fetchFamilyStats, fetchFamilyMembers, fetchUserHistory, fetchPendingPurchases,
        syncData,
        submitTask, takeTask, buyItem, confirmPurchase,
        createTask, deleteTask, verifyTask,
        createShopItem, deleteShopItem,
        addToast
    } = useStore();

    const fallbackId = '7409320181';

    useEffect(() => {
        const tg = window.Telegram?.WebApp;

        const load = async () => {
            let id = fallbackId;
            if (tg) {
                tg.expand();
                tg.ready();
                if (parseFloat(tg.version) >= 6.1) {
                    tg.setHeaderColor('#a8edea');
                    tg.setBackgroundColor('#fed6e3');
                }
                id = tg.initDataUnsafe?.user?.id?.toString() || fallbackId;
            }
            await fetchUser(id);
            await syncData(id);
            await fetchShop();
            await fetchFamilyMembers();
        };
        load();

        const pollId = setInterval(() => {
            const id = tg?.initDataUnsafe?.user?.id?.toString() || fallbackId;
            syncData(id);
        }, 5000);

        return () => clearInterval(pollId);
    }, [syncData, fetchUser, fetchShop, fetchFamilyMembers]);

    const handleTaskAction = async (taskId: number, action: string) => {
        if (!user) return;

        try {
            console.log(`Performing action ${action} on task ${taskId}`);
            switch (action) {
                case 'take':
                    await takeTask(taskId, user.telegramId);
                    break;
                case 'submit':
                    await submitTask(taskId);
                    break;
                case 'approve':
                    await verifyTask(taskId, true, user.telegramId);
                    break;
                case 'reject':
                    await verifyTask(taskId, false, user.telegramId);
                    break;
                case 'delete':
                    setConfirmConfig({
                        title: 'Удалить задание?',
                        message: 'Это действие нельзя будет отменить.',
                        onConfirm: async () => {
                            await deleteTask(taskId, user.telegramId);
                            await Promise.all([
                                fetchTasks(user.telegramId),
                                fetchUser(user.telegramId),
                                fetchFamilyStats()
                            ]);
                        }
                    });
                    return;
            }
            // Robust refresh
            await Promise.all([
                fetchTasks(user.telegramId),
                fetchUser(user.telegramId),
                fetchFamilyStats()
            ]);
            console.log('Task action completed and data refreshed');
        } catch (e: any) {
            console.error('Task action error:', e);
            addToast({ type: 'error', message: e.message || 'Ошибка выполнения действия' });
        }
    };

    const handleMemberClick = async (id: string, name: string) => {
        setSelectedMember({ id, name });
        await fetchUserHistory(id);
        setShowHistoryModal(true);
    };

    const handleShopAction = async (id: number, action: 'buy' | 'delete' | 'confirm') => {
        if (!user) return;
        if (action === 'buy') {
            const item = shopItems.find(i => i.id === id);
            if (!item) return;

            if (user.points < item.price) {
                setConfirmConfig({
                    title: 'Недостаточно баллов',
                    message: `Для покупки "${item.title}" нужно ${item.price} 💎. У вас пока ${user.points}.`,
                    actions: [
                        {
                            text: 'Жаль..',
                            className: 'bg-gray-100 text-gray-500 font-bold hover:bg-gray-200',
                            onClick: () => setConfirmConfig(null)
                        }
                    ]
                });
                return;
            }

            setConfirmConfig({
                title: 'Подтверждение покупки',
                message: `Вы действительно хотите купить "${item.title}" за ${item.price} 💎?`,
                actions: [
                    {
                        text: 'Отмена',
                        className: 'bg-red-500 text-white hover:bg-red-600',
                        onClick: () => setConfirmConfig(null)
                    },
                    {
                        text: 'Подтвердить',
                        className: 'bg-green-500 text-white hover:bg-green-600',
                        onClick: async () => {
                            try {
                                await buyItem(id, user.telegramId);
                                await fetchUser(user.telegramId);
                                setConfirmConfig(null);
                                addToast({ type: 'success', message: 'Покупка успешно совершена!' });
                            } catch (e: any) {
                                addToast({ type: 'error', message: e.message || 'Ошибка покупки' });
                            }
                        }
                    }
                ]
            });
        } else if (action === 'confirm') {
            const purchase = pendingPurchases.find(p => p.id === id);
            const itemName = purchase?.item?.title || 'этот товар';

            setConfirmConfig({
                title: 'Подтверждение выдачи',
                message: `Подтвердите, что вы выдали "${itemName}".`,
                actions: [
                    {
                        text: 'Отмена',
                        className: 'bg-red-500 text-white hover:bg-red-600',
                        onClick: () => setConfirmConfig(null)
                    },
                    {
                        text: 'Выдано',
                        className: 'bg-green-500 text-white hover:bg-green-600',
                        onClick: async () => {
                            try {
                                await useStore.getState().confirmPurchase(id, user.telegramId);
                                await fetchPendingPurchases();
                                await fetchUser(user.telegramId);
                                setConfirmConfig(null);
                                addToast({ type: 'success', message: 'Товар успешно выдан!' });
                            } catch (e: any) {
                                addToast({ type: 'error', message: 'Ошибка: ' + e.message });
                            }
                        }
                    }
                ]
            });
        } else {
            setConfirmConfig({
                title: 'Удалить товар?',
                message: 'Товар исчезнет из магазина навсегда.',
                onConfirm: async () => {
                    try {
                        await deleteShopItem(id, user.telegramId);
                        await fetchShop();
                        setConfirmConfig(null);
                        addToast({ type: 'success', message: 'Товар удален' });
                    } catch (e: any) {
                        addToast({ type: 'error', message: e.message || 'Ошибка удаления' });
                    }
                }
            });
        }
    };

    const handleTaskSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (user) {
            try {
                await createTask(formData, user.telegramId);
                setShowTaskModal(false);
                setFormData({ isGlobal: true });
                // Immediate refresh
                fetchTasks(user.telegramId);
                fetchFamilyStats();
                fetchUser(user.telegramId); // Refresh user points after creating task
                addToast({ type: 'success', message: 'Задание создано!' });
            } catch (e: any) {
                addToast({ type: 'error', message: e.message || 'Ошибка создания задания' });
            }
        }
    };

    const handleShopSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (user) {
            try {
                await createShopItem({ ...formData, icon: 'ShoppingBag' }, user.telegramId);
                setShowShopModal(false);
                setFormData({ isGlobal: true });
                await fetchShop();
                addToast({ type: 'success', message: 'Товар добавлен в магазин!' });
            } catch (e: any) {
                addToast({ type: 'error', message: e.message || 'Ошибка создания товара' });
            }
        }
    };

    if (loading && !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-500 font-medium animate-pulse">Загрузка данных...</p>
            </div>
        );
    }

    if (!user && !loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
                <div className="glass-card p-8 space-y-4">
                    <h2 className="text-2xl font-bold text-red-500">Доступ ограничен</h2>
                    <p className="text-gray-600">Ваш ID не найден в базе данных. Пожалуйста, добавьте себя через Пульт Управления.</p>
                </div>
            </div>
        );
    }

    const isParent = user?.role === 'parent';

    const renderDashboard = () => (
        <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            <div className="glass-card p-6 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Star size={120} />
                </div>
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-400 via-indigo-500 to-purple-600 p-1 mb-4 shadow-xl">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                        <User size={48} className="text-gray-200" />
                    </div>
                </div>
                <h2 className="text-2xl font-black text-gray-800 tracking-tight leading-tight">{user?.name}</h2>
                <div className="mt-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    {isParent ? (
                        <><ShieldCheck size={14} /> Родитель</>
                    ) : (
                        <><UserPlus size={14} /> Ребёнок</>
                    )}
                </div>

                <div className="mt-8 w-full flex items-center justify-center gap-3 bg-gradient-to-br from-blue-50 to-indigo-50/50 px-8 py-5 rounded-[32px] shadow-inner border border-white/50">
                    <div className="bg-white p-2 rounded-2xl shadow-sm text-blue-500">
                        <Wallet size={24} />
                    </div>
                    <div className="text-left">
                        <span className="text-4xl font-black text-blue-600 tracking-tighter block leading-none">{user?.points || 0}</span>
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Текущий баланс</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {[
                    { icon: History, label: 'История', color: 'text-blue-500', action: () => handleMemberClick(user!.telegramId, user!.name) },
                    { icon: ShoppingBag, label: 'Магазин', color: 'text-pink-500', tab: 'shop' }
                ].map((item, idx) => (
                    <button
                        key={idx}
                        onClick={item.tab ? () => setActiveTab(item.tab!) : item.action}
                        className="glass-card p-6 text-center flex flex-col items-center justify-center space-y-2 hover:bg-white/60 transition-all active:scale-95 duration-200"
                    >
                        <item.icon className={item.color} size={32} />
                        <span className="font-bold text-gray-700">{item.label}</span>
                    </button>
                ))}
            </div>

            {isParent && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold px-1 text-gray-800">Быстрые действия</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setShowTaskModal(true)}
                            className="bg-indigo-600 text-white p-4 rounded-2xl font-bold text-sm shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <UserPlus size={18} /> Задание
                        </button>
                        <button
                            onClick={() => setShowShopModal(true)}
                            className="bg-pink-600 text-white p-4 rounded-2xl font-bold text-sm shadow-xl shadow-pink-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <ShoppingBag size={18} /> Товар
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );

    const filteredTasks = tasks.filter(t => {
        if (isParent) {
            return taskSubTab === 'review' ? t.status === 'pending' : t.status !== 'pending' && t.status !== 'completed';
        } else {
            return taskSubTab === 'global' ? t.isGlobal : !t.isGlobal;
        }
    });

    const renderTasks = () => (
        <motion.div
            key="tasks"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight">Задания</h3>
            </div>

            {/* Sub-tabs */}
            <div className="flex p-1 bg-gray-100/50 rounded-2xl gap-1">
                <button
                    onClick={() => setTaskSubTab(isParent ? 'active' : 'personal')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${(isParent ? taskSubTab === 'active' : taskSubTab === 'personal')
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    {isParent ? 'В работе' : 'Личные'}
                </button>
                <button
                    onClick={() => setTaskSubTab(isParent ? 'review' : 'global')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${(isParent ? taskSubTab === 'review' : taskSubTab === 'global')
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    {isParent ? (
                        <span className="flex items-center justify-center gap-2">
                            Проверка
                            {tasks.some(t => t.status === 'pending') && (
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            )}
                        </span>
                    ) : 'Общие'}
                </button>
            </div>

            <div className="space-y-4">
                {filteredTasks.length === 0 ? (
                    <div className="glass-card p-12 text-center space-y-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
                            {taskSubTab === 'review' ? <ShieldCheck size={32} /> : <CheckCircle2 size={32} />}
                        </div>
                        <p className="text-gray-400 font-medium">Нет заданий в этой категории</p>
                    </div>
                ) : filteredTasks.map(task => {
                    const assignee = familyMembers.find(m => m.id === task.assigneeId);
                    return (
                        <TaskCard
                            key={task.id}
                            task={task as any}
                            role={user?.role as any}
                            onAction={handleTaskAction}
                            assigneeName={assignee?.name}
                        />
                    );
                })}
            </div>
        </motion.div>
    );

    const renderShop = () => {
        return (
            <motion.div
                key="shop"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black text-gray-800 tracking-tight">Магазин</h3>
                </div>

                <div className="flex p-1 bg-gray-100/50 rounded-2xl gap-1">
                    <button
                        onClick={() => setShopSubTab('catalog')}
                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${shopSubTab === 'catalog'
                            ? 'bg-white text-pink-600 shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        Каталог
                    </button>
                    <button
                        onClick={() => {
                            setShopSubTab('orders');
                            if (isParent) fetchPendingPurchases();
                        }}
                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${shopSubTab === 'orders'
                            ? 'bg-white text-pink-600 shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                            }`}
                    >
                        {isParent ? (
                            <span className="flex items-center justify-center gap-2">
                                Выдача
                                {pendingPurchases.length > 0 && (
                                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                                )}
                            </span>
                        ) : 'Куплено'}
                    </button>
                </div>

                {shopSubTab === 'catalog' ? (
                    <div className="grid grid-cols-2 gap-4">
                        {shopItems.length === 0 ? (
                            <div className="col-span-2 glass-card p-12 text-center text-gray-400">Магазин пуст</div>
                        ) : shopItems.map((item) => (
                            <ShopCard
                                key={item.id}
                                item={item}
                                isParent={isParent}
                                onBuy={(id) => handleShopAction(id, 'buy')}
                                onDelete={(id) => handleShopAction(id, 'delete')}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {(isParent ? pendingPurchases : userHistory?.purchases.filter(p => p.status === 'ordered'))?.length === 0 ? (
                            <div className="glass-card p-12 text-center text-gray-400">Нет активных заказов</div>
                        ) : (isParent ? pendingPurchases : userHistory?.purchases.filter(p => p.status === 'ordered'))?.map((p: any) => (
                            <div key={p.id} className="glass-card p-4 flex items-center gap-4 bg-white/50 border-white/60">
                                <div className="w-12 h-12 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-600">
                                    <ShoppingBag size={24} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-gray-900 leading-tight">{p.item?.title || 'Товар'}</h4>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                                        {isParent ? `Заказал: ${p.user?.name}` : 'Ожидает получения'}
                                    </p>
                                </div>
                                {isParent && (
                                    <button
                                        onClick={() => handleShopAction(p.id, 'confirm')}
                                        className="bg-green-500 text-white p-2.5 rounded-xl shadow-lg shadow-green-100 active:scale-95"
                                    >
                                        <ShieldCheck size={20} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>
        );
    };

    const renderProfile = () => (
        <motion.div
            key="profile"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
        >
            <FamilyStats
                members={familyStats}
                onMemberClick={handleMemberClick}
            />
        </motion.div>
    );

    return (
        <ErrorBoundary>
            <ToastContainer />
            <div className="min-h-screen bg-slate-50/30 overflow-x-hidden">
                <div className="p-4 pt-[env(safe-area-inset-top,1rem)] pb-[calc(env(safe-area-inset-bottom,1rem)+12rem)] max-w-md mx-auto">
                    <header className="mb-8 pt-4 flex justify-between items-center sticky top-0 z-40 bg-transparent">
                        <div className="backdrop-blur-sm bg-white/10 px-4 py-2 rounded-2xl border border-white/20">
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none">Family<span className="text-blue-500">Rewards</span></h1>
                            <div className="flex items-center space-x-2 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none">Система онлайн</span>
                            </div>
                        </div>
                    </header>

                    <main>
                        {activeTab === 'dashboard' && renderDashboard()}
                        {activeTab === 'tasks' && renderTasks()}
                        {activeTab === 'shop' && renderShop()}
                        {activeTab === 'profile' && renderProfile()}
                    </main>

                    {/* Modals */}
                    <Modal show={showTaskModal} onClose={() => setShowTaskModal(false)} title="Новое задание">
                        <form onSubmit={handleTaskSubmit} className="space-y-6">
                            <div className="space-y-6">
                                {/* Type Selector */}
                                <div className="p-1.5 bg-slate-100 rounded-[24px] flex gap-1 relative">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isGlobal: true, assigneeId: null })}
                                        className={`flex-1 py-3.5 rounded-[20px] text-sm font-black flex items-center justify-center gap-2 transition-all duration-300 ${formData.isGlobal
                                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-200'
                                            : 'text-gray-400 hover:text-gray-600'
                                            }`}
                                    >
                                        <Globe size={18} />
                                        ВСЕМ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isGlobal: false })}
                                        className={`flex-1 py-3.5 rounded-[20px] text-sm font-black flex items-center justify-center gap-2 transition-all duration-300 ${!formData.isGlobal
                                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-200'
                                            : 'text-gray-400 hover:text-gray-600'
                                            }`}
                                    >
                                        <User size={18} />
                                        ЛИЧНОЕ
                                    </button>
                                </div>

                                {!formData.isGlobal && (
                                    <div className="grid grid-cols-2 gap-3">
                                        {familyMembers.map(child => (
                                            <button
                                                key={child.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, assigneeId: child.id })}
                                                className={`p-4 rounded-[24px] border-2 text-sm font-bold flex items-center gap-3 transition-all duration-300 ${formData.assigneeId === child.id
                                                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-lg shadow-purple-100'
                                                    : 'border-transparent bg-slate-50 text-gray-500 hover:bg-slate-100'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-colors ${formData.assigneeId === child.id ? 'bg-purple-200 text-purple-700' : 'bg-white text-gray-400'}`}>
                                                    <User size={14} />
                                                </div>
                                                {child.name}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Задача</label>
                                        <input
                                            className="w-full px-6 py-5 rounded-[24px] bg-slate-50 border-2 border-transparent focus:border-purple-500 focus:bg-white outline-none transition-all font-bold text-lg text-gray-900 placeholder:text-gray-400 shadow-sm"
                                            placeholder="Название задания"
                                            value={formData.title || ''}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <textarea
                                        className="w-full px-6 py-5 rounded-[24px] bg-slate-50 border-2 border-transparent focus:border-purple-500 focus:bg-white outline-none transition-all font-medium text-base text-gray-800 placeholder:text-gray-400 shadow-sm resize-none h-32"
                                        placeholder="Опишите подробнее..."
                                        value={formData.description || ''}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-green-600/60 uppercase tracking-widest pl-4">Вознаграждение</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full px-6 py-5 pr-20 rounded-[24px] bg-green-50/50 border-2 border-green-100 focus:border-green-500 focus:bg-white outline-none transition-all font-black text-3xl text-green-600 placeholder:text-green-500 shadow-sm text-left"
                                            placeholder="0"
                                            value={formData.reward || ''}
                                            onChange={e => setFormData({ ...formData, reward: Number(e.target.value) })}
                                            required
                                        />
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none opacity-50">
                                            <Star size={20} className="text-green-600 fill-green-600" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-5 rounded-[28px] font-black text-lg shadow-[0_10px_40px_-10px_rgba(147,51,234,0.5)] active:scale-[0.98] transition-all hover:shadow-[0_20px_40px_-10px_rgba(147,51,234,0.6)] mt-4">
                                СОЗДАТЬ ЗАДАНИЕ
                            </button>
                        </form>
                    </Modal>

                    <Modal show={showShopModal} onClose={() => setShowShopModal(false)} title="Новый товар">
                        <form onSubmit={handleShopSubmit} className="space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-pink-900/40 uppercase tracking-widest pl-4">Товар</label>
                                        <input
                                            className="w-full px-6 py-5 rounded-[24px] bg-slate-50 border-2 border-transparent focus:border-pink-500 focus:bg-white outline-none transition-all font-bold text-lg text-gray-900 placeholder:text-gray-400 shadow-sm"
                                            placeholder="Название награды"
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <textarea
                                        className="w-full px-6 py-5 rounded-[24px] bg-slate-50 border-2 border-transparent focus:border-pink-500 focus:bg-white outline-none transition-all font-medium text-base text-gray-800 placeholder:text-gray-400 shadow-sm resize-none h-32"
                                        placeholder="Опишите награду или условия..."
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-pink-600/60 uppercase tracking-widest pl-4">Стоимость</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full px-6 py-5 pr-20 rounded-[24px] bg-pink-50/50 border-2 border-pink-100 focus:border-pink-500 focus:bg-white outline-none transition-all font-black text-3xl text-pink-500 placeholder:text-pink-500 shadow-sm text-left"
                                            placeholder="0"
                                            onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                                            required
                                        />
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none opacity-60">
                                            <span className="text-xl">💎</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white py-5 rounded-[28px] font-black text-lg shadow-[0_10px_40px_-10px_rgba(236,72,153,0.5)] active:scale-[0.98] transition-all hover:shadow-[0_20px_40px_-10px_rgba(236,72,153,0.6)]">
                                ДОБАВИТЬ В МАГАЗИН
                            </button>
                        </form>
                    </Modal>

                    <HistoryModal
                        show={showHistoryModal}
                        onClose={() => setShowHistoryModal(false)}
                        history={userHistory}
                        userName={selectedMember?.name || ''}
                    />

                    <ConfirmModal
                        show={!!confirmConfig}
                        onClose={() => setConfirmConfig(null)}
                        onConfirm={confirmConfig?.onConfirm || (() => { })}
                        title={confirmConfig?.title || ''}
                        message={confirmConfig?.message || ''}
                        actions={confirmConfig?.actions}
                    />

                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[300px]">
                        <nav className="bg-white/95 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-[32px] p-2 flex justify-between items-center">
                            {[
                                { id: 'dashboard', icon: LayoutGrid, activeClass: 'bg-purple-600 shadow-purple-200' },
                                { id: 'tasks', icon: CheckCircle2, activeClass: 'bg-green-500 shadow-green-200' },
                                { id: 'shop', icon: ShoppingBag, activeClass: 'bg-pink-500 shadow-pink-200' },
                                { id: 'profile', icon: User, activeClass: 'bg-blue-500 shadow-blue-200' },
                            ].map((tab) => {
                                const isActive = activeTab === tab.id;
                                const Icon = tab.icon;

                                // Badge Logic
                                let showBadge = false;
                                if (isParent) {
                                    if (tab.id === 'tasks') {
                                        showBadge = tasks.some(t => t.status === 'pending');
                                    } else if (tab.id === 'shop') {
                                        showBadge = pendingPurchases.length > 0;
                                    }
                                }

                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`relative w-12 h-12 rounded-[20px] flex items-center justify-center transition-all duration-300 ${isActive
                                            ? `${tab.activeClass} text-white shadow-lg scale-105`
                                            : 'text-gray-400 hover:text-gray-600'
                                            }`}
                                    >
                                        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                                        {showBadge && (
                                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm animate-pulse" />
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                </div>
            </div>
        </ErrorBoundary>
    );
}

export default App;
