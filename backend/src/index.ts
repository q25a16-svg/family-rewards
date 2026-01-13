import './server.js';
import { Bot, GrammyError, HttpError } from 'grammy';
import 'dotenv/config';
import prisma from './db/client.js';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is required');

import { registerAdmin } from './bot/admin.js';

const bot = new Bot(token);

// Register Admin Module
// Standard register without hardcoded IDs - relies on DB IsAdmin flag
const adminIds: string[] = [];

// --- First Run Initialization Middleware ---
bot.use(async (ctx, next) => {
    // Only check for text messages in private chats
    if (ctx.chat?.type !== 'private' || !ctx.message?.text) return next();

    // Check if system is already initialized
    const userCount = await prisma.user.count();
    if (userCount > 0) return next();

    const text = ctx.message.text.trim();
    if (text === '/start') {
        return ctx.reply('🚀 <b>Первый запуск системы!</b>\n\nБаза данных пуста. Пожалуйста, введите код инициализации администратора:', { parse_mode: 'HTML' });
    }

    if (text === '2604') {
        try {
            const userId = ctx.from?.id.toString();
            if (!userId) return ctx.reply('❌ Не удалось определить ваш ID.');

            await prisma.user.create({
                data: {
                    name: ctx.from?.first_name || 'Admin',
                    telegramId: userId,
                    role: 'parent',
                    isAdmin: true,
                    points: 999
                }
            });
            await ctx.reply(`✅ <b>Система инициализирована!</b>\n\nВы (${ctx.from?.first_name}) назначены Супер-Администратором.\nНажмите /admin для входа в панель.`, { parse_mode: 'HTML' });
        } catch (e) {
            console.error(e);
            await ctx.reply('❌ Ошибка при создании администратора.');
        }
    } else {
        await ctx.reply('⛔ <b>Неверный код!</b>\nПовторите попытку:', { parse_mode: 'HTML' });
    }
});


bot.command('start', async (ctx) => {
    const tgId = ctx.from?.id.toString();
    if (!tgId) return;

    let user = await prisma.user.findUnique({
        where: { telegramId: tgId }
    });

    if (!user) {
        return ctx.reply('⛔ У вас нет доступа к этому приложению. Обратитесь к родителям.');
    }

    try {
        await ctx.reply(`✨ Привет, ${user.name}! Рады тебя видеть.`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🚀 Войти в приложение", web_app: { url: process.env.WEBAPP_URL || '' } }]
                ]
            }
        });
    } catch (error) {
        console.error('Failed to send start message:', error);
        await ctx.reply(`✨ Привет, ${user.name}! Рады тебя видеть.\n\n⚠️ Ошибка: Телеграм требует HTTPS для кнопок Mini App. Используйте туннель (ngrok/localtunnel) и обновите WEBAPP_URL в .env`);
    }
});

// Error handling
// Register Admin Module LAST to avoid blocking other commands
registerAdmin(bot, adminIds);

bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
        console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
        console.error("Could not contact Telegram:", e);
    } else {
        console.error("Unknown error:", e);
    }
});

bot.start({
    onStart: async (me) => {
        console.log(`🤖 Bot @${me.username} is running...`);

        // Sync Menu Button with current Tunnel URL
        const webAppUrl = process.env.WEBAPP_URL;
        if (webAppUrl && webAppUrl.startsWith('https')) {
            try {
                await bot.api.setChatMenuButton({
                    menu_button: {
                        type: 'web_app',
                        text: 'Famili 🏠✨',
                        web_app: { url: webAppUrl }
                    }
                });
                console.log(`✅ Menu button synced: ${webAppUrl}`);
            } catch (error) {
                console.error('❌ Failed to sync menu button:', error);
            }
        }
    }
});
