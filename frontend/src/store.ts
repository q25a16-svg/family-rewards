import { create } from 'zustand';

interface User {
    id: number;
    telegramId: string;
    name: string;
    role: 'parent' | 'child';
    points: number;
}

interface Task {
    id: number;
    title: string;
    description: string;
    reward: number;
    status: 'active' | 'in_progress' | 'pending' | 'completed';
    assigneeId?: number;
    isGlobal: boolean;
}

interface StoreItem {
    id: number;
    title: string;
    description: string;
    price: number;
}

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
}

interface AppState {
    user: User | null;
    tasks: Task[];
    shopItems: StoreItem[];
    familyStats: any[];
    familyMembers: User[];
    pendingPurchases: any[];
    userHistory: { tasks: Task[], purchases: any[] } | null;
    loading: boolean;
    setUser: (user: User) => void;
    fetchUser: (tgId: string) => Promise<void>;
    fetchTasks: (tgId: string) => Promise<void>;
    fetchShop: () => Promise<void>;
    fetchFamilyStats: () => Promise<void>;
    fetchFamilyMembers: () => Promise<void>;
    fetchUserHistory: (tgId: string) => Promise<void>;
    fetchPendingPurchases: () => Promise<void>;

    // Child Actions
    takeTask: (taskId: number, tgId: string) => Promise<void>;
    submitTask: (taskId: number) => Promise<void>;
    buyItem: (itemId: number, tgId: string) => Promise<void>;
    confirmPurchase: (purchaseId: number, parentTgId: string) => Promise<void>;

    // Toast Actions
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;

    // Parent Actions - Tasks
    createTask: (data: Partial<Task> & { isGlobal: boolean, creatorTgId: string }, creatorTgId: string) => Promise<void>;
    updateTask: (taskId: number, data: Partial<Task>, tgId: string) => Promise<void>;
    deleteTask: (taskId: number, tgId: string) => Promise<void>;
    verifyTask: (taskId: number, approve: boolean, parentTgId: string) => Promise<void>;

    // Parent Actions - Shop
    createShopItem: (data: Partial<StoreItem>, tgId: string) => Promise<void>;
    updateShopItem: (itemId: number, data: Partial<StoreItem>, tgId: string) => Promise<void>;
    deleteShopItem: (itemId: number, tgId: string) => Promise<void>;
}

const API_URL = '/api';

export const useStore = create<AppState>((set, get) => ({
    toasts: [],

    addToast: (toast) => {
        const id = Math.random().toString(36).substring(7);
        set(state => ({ toasts: [...state.toasts, { ...toast, id }] }));
        setTimeout(() => get().removeToast(id), 4000);
    },
    removeToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

    user: null,
    tasks: [],
    shopItems: [],
    familyStats: [],
    familyMembers: [],
    pendingPurchases: [],
    userHistory: null,
    loading: false,

    setUser: (user) => set({ user }),

    fetchUser: async (tgId) => {
        set({ loading: true });
        try {
            const res = await fetch(`${API_URL}/user/${tgId}`);
            if (!res.ok) throw new Error('User not found');
            const data = await res.json();
            set({ user: data, loading: false });
        } catch (e) {
            console.error(e);
            set({ loading: false, user: null });
        }
    },

    fetchFamilyStats: async () => {
        try {
            const res = await fetch(`${API_URL}/family/stats`);
            const data = await res.json();
            set({ familyStats: data });
        } catch (e) {
            console.error(e);
        }
    },

    fetchFamilyMembers: async () => {
        try {
            const res = await fetch(`${API_URL}/family/members`);
            const data = await res.json();
            set({ familyMembers: data });
        } catch (e) {
            console.error(e);
        }
    },

    fetchUserHistory: async (tgId) => {
        try {
            const res = await fetch(`${API_URL}/user/${tgId}/history`);
            const data = await res.json();
            set({ userHistory: data });
        } catch (e) {
            console.error(e);
        }
    },
    fetchPendingPurchases: async () => {
        try {
            const res = await fetch(`${API_URL}/purchases/pending`);
            const data = await res.json();
            set({ pendingPurchases: data });
        } catch (e) {
            console.error(e);
        }
    },

    fetchTasks: async (tgId) => {
        try {
            const res = await fetch(`${API_URL}/tasks?tgId=${tgId}`);
            const data = await res.json();
            set({ tasks: Array.isArray(data) ? data : [] });
        } catch (e) {
            console.error(e);
        }
    },

    fetchShop: async () => {
        try {
            const res = await fetch(`${API_URL}/shop`);
            const data = await res.json();
            set({ shopItems: Array.isArray(data) ? data : [] });
        } catch (e) {
            console.error(e);
        }
    },

    takeTask: async (taskId, tgId) => {
        const currentUser = get().user;
        // Optimistic update
        set((state) => ({
            tasks: state.tasks.map(t =>
                t.id === taskId
                    ? { ...t, status: 'in_progress', assigneeId: currentUser?.id, isGlobal: false }
                    : t
            )
        }));

        try {
            await fetch(`${API_URL}/tasks/${taskId}/take`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tgId })
            });
            // Background sync
            get().fetchTasks(tgId);
            get().fetchUser(tgId);
        } catch (e) {
            console.error(e);
            get().fetchTasks(tgId); // Revert on error
        }
    },

    submitTask: async (taskId) => {
        // Optimistic update
        set((state) => ({
            tasks: state.tasks.map(t => t.id === taskId ? { ...t, status: 'pending' } : t)
        }));

        try {
            console.log('Filing submission for task:', taskId);
            // Sending empty JSON object to satisfy strict Fastify content-type requirements
            const res = await fetch(`${API_URL}/tasks/${taskId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            if (!res.ok) {
                let errorMessage = `Status: ${res.status}`;
                try {
                    const errData = await res.json();
                    // Fastify returns { message: "...", error: "..." }. Message is usually more specific.
                    errorMessage = errData.message || errData.error || errorMessage;
                } catch {
                    errorMessage = await res.text() || errorMessage;
                }
                throw new Error(errorMessage);
            }
            const data = await res.json();
            console.log('Submission result:', data);

            const user = get().user;
            if (user) await get().fetchTasks(user.telegramId);
        } catch (e) {
            console.error('Submit task error:', e);
            // Revert state on error by fetching
            const user = get().user;
            if (user) get().fetchTasks(user.telegramId);
            throw e;
        }
    },

    buyItem: async (itemId, tgId) => {
        // Optimistic points deduction
        const state = get();
        const item = state.shopItems.find(i => i.id === itemId);
        if (state.user && item) {
            set({ user: { ...state.user, points: state.user.points - item.price } });
        }

        try {
            const res = await fetch(`${API_URL}/shop/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, userTgId: tgId })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Buy failed');
            }
            await get().fetchUser(tgId);
            await get().fetchUserHistory(tgId);
        } catch (e) {
            console.error(e);
            get().fetchUser(tgId); // Revert on error
            throw e;
        }
    },

    confirmPurchase: async (purchaseId, parentTgId) => {
        try {
            const res = await fetch(`${API_URL}/purchases/${purchaseId}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Server error');
            }
            await get().fetchPendingPurchases();
            await get().fetchFamilyStats();
        } catch (e) {
            console.error(e);
            throw e;
        }
    },

    // Parent Actions
    createTask: async (data, creatorTgId) => {
        try {
            await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, creatorTgId })
            });
            get().fetchTasks(creatorTgId);
        } catch (e) {
            console.error(e);
        }
    },

    updateTask: async (taskId, data, tgId) => {
        try {
            await fetch(`${API_URL}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            get().fetchTasks(tgId);
        } catch (e) {
            console.error(e);
        }
    },

    deleteTask: async (taskId, tgId) => {
        // Optimistic delete
        set((state) => ({ tasks: state.tasks.filter(t => t.id !== taskId) }));

        try {
            await fetch(`${API_URL}/tasks/${taskId}`, { method: 'DELETE' });
            // Background sync
            get().fetchTasks(tgId);
        } catch (e) {
            console.error(e);
            get().fetchTasks(tgId); // Revert
        }
    },

    verifyTask: async (taskId, approve, parentTgId) => {
        // Optimistic update
        set((state) => ({
            tasks: state.tasks.map(t =>
                t.id === taskId
                    ? { ...t, status: approve ? 'completed' : 'active' }
                    : t
            )
        }));

        try {
            await fetch(`${API_URL}/tasks/${taskId}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approve, parentTgId })
            });
            get().fetchTasks(parentTgId);
            get().fetchFamilyStats();
        } catch (e) {
            console.error(e);
            get().fetchTasks(parentTgId); // Revert
        }
    },

    createShopItem: async (data, tgId) => {
        try {
            await fetch(`${API_URL}/shop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, creatorTgId: tgId })
            });
            get().fetchShop();
        } catch (e) {
            console.error(e);
        }
    },

    updateShopItem: async (itemId, data, tgId) => {
        try {
            await fetch(`${API_URL}/shop/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            get().fetchShop();
        } catch (e) {
            console.error(e);
        }
    },

    deleteShopItem: async (itemId, tgId) => {
        try {
            await fetch(`${API_URL}/shop/${itemId}`, { method: 'DELETE' });
            get().fetchShop();
        } catch (e) {
            console.error(e);
        }
    }
}));
