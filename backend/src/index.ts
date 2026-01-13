import './server.js';
import { Bot, GrammyError, HttpError } from 'grammy';
import 'dotenv/config';
import prisma from './db/client.js';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is required');

const bot = new Bot(token);

bot.command('start', async (ctx) => {
    const tgId = ctx.from?.id.toString();
    if (!tgId) return;

    const user = await prisma.user.findUnique({
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
