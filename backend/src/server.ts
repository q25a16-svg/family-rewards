import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from './db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
    origin: true
});

// Log all requests
fastify.addHook('onRequest', async (request, reply) => {
    console.log(`📥 INCOMING REQUEST: ${request.method} ${request.url}`);
});

// Serve static frontend files
const staticPath = path.join(__dirname, '../../frontend/dist');
console.log('Static file path calculated:', staticPath);

try {
    const fs = await import('fs');
    if (fs.existsSync(staticPath)) {
        console.log('Static directory exists. Contents:', fs.readdirSync(staticPath));
    } else {
        console.error('⚠️ STATIC DIRECTORY DOES NOT EXIST AT:', staticPath);
        // Fallback debug: list parent dirs to find where it is
        const appPath = '/app';
        if (fs.existsSync(appPath)) {
            console.log('/app contents:', fs.readdirSync(appPath));
            if (fs.existsSync('/app/frontend')) {
                console.log('/app/frontend contents:', fs.readdirSync('/app/frontend'));
            } else {
                console.log('/app/frontend does not exist');
            }
        } else {
            console.log('/app does not exist');
        }
    }
} catch (e) {
    console.error('Error checking static files:', e);
}

await fastify.register(fastifyStatic, {
    root: staticPath,
    prefix: '/',
});



fastify.get('/ping', async () => {
    return { status: 'ok', message: 'pong' };
});

fastify.get('/', async (req, reply) => {
    return reply.sendFile('index.html');
});

// --- Sync Logic (Real-time) ---
fastify.get('/api/sync', async (request, reply) => {
    const { tgId } = request.query as { tgId: string };
    const user = await prisma.user.findUnique({ where: { telegramId: tgId } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const [tasks, familyStats, pendingPurchases] = await Promise.all([
        // Tasks for the specific user context
        user.role === 'parent'
            ? prisma.task.findMany({ include: { assignee: true }, orderBy: { id: 'desc' } })
            : prisma.task.findMany({
                where: {
                    OR: [{ assigneeId: user.id }, { isGlobal: true, status: 'active' }],
                    status: { in: ['active', 'in_progress', 'pending'] }
                },
                orderBy: { id: 'desc' }
            }),
        // Family stats for progress tracking
        prisma.user.findMany({
            where: { role: 'child' },
            include: { tasks: { where: { status: 'completed' } }, purchases: true }
        }).then(users => users.map(u => ({
            id: u.id, name: u.name, telegramId: u.telegramId, points: u.points,
            completedTasks: u.tasks.length, purchasesCount: u.purchases.length
        }))),
        // Global pending purchases for parent badges
        user.role === 'parent'
            ? prisma.purchase.findMany({ where: { status: 'ordered' }, include: { user: true, item: true }, orderBy: { createdAt: 'desc' } })
            : []
    ]);

    return {
        tasks,
        familyStats,
        pendingPurchases,
        userPoints: user.points // Always keep points in sync
    };
});

// --- User Logic ---
fastify.get('/api/user/:tgId', async (request, reply) => {
    const { tgId } = request.params as { tgId: string };
    const user = await prisma.user.findUnique({
        where: { telegramId: tgId },
        include: { tasks: true, purchases: { include: { item: true } } }
    });
    return user || reply.status(404).send({ error: 'User not found' });
});

// --- Family Stats & Members ---
fastify.get('/api/family/stats', async (request, reply) => {
    const users = await prisma.user.findMany({
        where: { role: 'child' },
        include: {
            tasks: { where: { status: 'completed' } },
            purchases: true
        }
    });
    return users.map((u: any) => ({
        id: u.id,
        name: u.name,
        telegramId: u.telegramId,
        points: u.points,
        completedTasks: u.tasks.length,
        purchasesCount: u.purchases.length
    }));
});

fastify.get('/api/family/members', async () => {
    return prisma.user.findMany({ where: { role: 'child' } });
});

fastify.get('/api/user/:tgId/history', async (request, reply) => {
    const { tgId } = request.params as { tgId: string };
    const user = await prisma.user.findUnique({ where: { telegramId: tgId } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const tasks = await prisma.task.findMany({
        where: {
            OR: [
                { assigneeId: user.id, status: 'completed' },
                { isGlobal: true, status: 'completed' } // This logic might need refinement if global tasks can be completed by many
            ]
        },
        orderBy: { id: 'desc' }
    });

    const purchases = await prisma.purchase.findMany({
        where: { userId: user.id },
        include: { item: true },
        orderBy: { id: 'desc' }
    });

    return { tasks, purchases };
});

// --- Tasks Logic ---
fastify.get('/api/tasks', async (request, reply) => {
    const { tgId } = request.query as { tgId: string };
    const user = await prisma.user.findUnique({ where: { telegramId: tgId } });

    if (!user) return reply.status(403).send({ error: 'Unauthorized' });

    if (user.role === 'parent') {
        return prisma.task.findMany({
            include: { assignee: true },
            orderBy: { id: 'desc' }
        });
    } else {
        return prisma.task.findMany({
            where: {
                OR: [
                    { assigneeId: user.id },
                    { isGlobal: true, status: 'active' }
                ],
                status: { in: ['active', 'in_progress', 'pending'] }
            },
            orderBy: { id: 'desc' }
        });
    }
});

fastify.post('/api/tasks/:id/take', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { tgId } = request.body as { tgId: string };

    const user = await prisma.user.findUnique({ where: { telegramId: tgId } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    return prisma.task.update({
        where: { id: Number(id) },
        data: {
            status: 'in_progress',
            assigneeId: user.id,
            isGlobal: false // No longer global once taken
        }
    });
});

fastify.post('/api/tasks', async (request, reply) => {
    const { title, description, reward, assigneeId, isGlobal, creatorTgId } = request.body as any;
    const creator = await prisma.user.findUnique({ where: { telegramId: creatorTgId } });

    if (!creator || creator.role !== 'parent') return reply.status(403).send({ error: 'Only parents can create tasks' });

    return prisma.task.create({
        data: { title, description, reward, assigneeId: assigneeId ? Number(assigneeId) : null, isGlobal, status: 'active' }
    });
});

fastify.put('/api/tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title, description, reward, assigneeId, isGlobal } = request.body as any;
    return prisma.task.update({
        where: { id: Number(id) },
        data: { title, description, reward, assigneeId: assigneeId ? Number(assigneeId) : null, isGlobal }
    });
});

fastify.delete('/api/tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.task.delete({ where: { id: Number(id) } });
    return { success: true };
});

fastify.post('/api/tasks/:id/submit', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
        await prisma.task.update({
            where: { id: Number(id) },
            data: { status: 'pending' }
        });
        return reply.send({ success: true });
    } catch (error) {
        return reply.status(404).send({ error: 'Task not found or update failed' });
    }
});

fastify.post('/api/tasks/:id/verify', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { approve, parentTgId } = request.body as { approve: boolean, parentTgId: string };

    const parent = await prisma.user.findUnique({ where: { telegramId: parentTgId } });
    if (!parent || parent.role !== 'parent') return reply.status(403).send({ error: 'Unauthorized' });

    const task = await prisma.task.findUnique({ where: { id: Number(id) } });
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    if (task.status !== 'pending') return reply.status(400).send({ error: 'Task not in pending state' });

    if (approve) {
        // Find who completed it (the assignee)
        if (!task.assigneeId) return reply.status(400).send({ error: 'No assignee for verification' });

        await prisma.$transaction([
            prisma.task.update({
                where: { id: Number(id) },
                data: { status: 'completed' }
            }),
            prisma.user.update({
                where: { id: task.assigneeId },
                data: { points: { increment: task.reward } }
            })
        ]);
    } else {
        await prisma.task.update({
            where: { id: Number(id) },
            data: { status: 'active', assigneeId: task.isGlobal ? null : task.assigneeId }
        });
    }

    return { success: true };
});

// --- Shop Logic ---
fastify.get('/api/shop', async () => {
    return prisma.storeItem.findMany({ orderBy: { id: 'desc' } });
});

fastify.post('/api/shop', async (request, reply) => {
    const { title, description, price, creatorTgId } = request.body as any;
    const creator = await prisma.user.findUnique({ where: { telegramId: creatorTgId } });
    if (!creator || creator.role !== 'parent') return reply.status(403).send({ error: 'Unauthorized' });

    return prisma.storeItem.create({
        data: { title, description, price }
    });
});

fastify.put('/api/shop/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title, description, price } = request.body as any;
    return prisma.storeItem.update({
        where: { id: Number(id) },
        data: { title, description, price }
    });
});

fastify.delete('/api/shop/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.storeItem.delete({ where: { id: Number(id) } });
    return { success: true };
});

fastify.post('/api/shop/buy', async (request, reply) => {
    const { itemId, userTgId } = request.body as { itemId: number, userTgId: string };

    const user = await prisma.user.findUnique({ where: { telegramId: userTgId } });
    const item = await prisma.storeItem.findUnique({ where: { id: itemId } });

    if (!user || !item) return reply.status(404).send({ error: 'User or Item not found' });
    if (user.points < item.price) return reply.status(400).send({ error: 'Not enough points' });

    await prisma.user.update({
        where: { id: user.id },
        data: { points: { decrement: item.price } }
    });

    return prisma.purchase.create({
        data: { userId: user.id, itemId: item.id, status: 'ordered' }
    });
});

fastify.get('/api/purchases/pending', async (request, reply) => {
    return prisma.purchase.findMany({
        where: { status: 'ordered' },
        include: { user: true, item: true },
        orderBy: { createdAt: 'desc' }
    });
});

fastify.post('/api/purchases/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.purchase.update({
        where: { id: Number(id) },
        data: { status: 'fulfilled' }
    });
    return { success: true };
});

const start = async () => {
    // Fallback for SPA
    fastify.setNotFoundHandler((req, reply) => {
        if (req.raw.url && req.raw.url.startsWith('/api')) {
            reply.status(404).send({ error: 'API endpoint not found' });
        } else {
            reply.sendFile('index.html');
        }
    });

    try {
        const port = Number(process.env.PORT) || 3000;
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`🚀 Server is running on http://0.0.0.0:${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
