import { Bot, Context, session, InlineKeyboard } from 'grammy';
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../db/client.js';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../');
const PROXY_CONFIG_PATH = path.join(ROOT_DIR, '.proxy_config');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const BACKEND_ENV_FILE = path.join(ROOT_DIR, 'backend/.env');

// --- State ---
interface AdminState {
    tunnelProcess: any | null;
    tunnelUrl: string | null;
    tunnelStatus: 'ACTIVE' | 'INACTIVE' | 'STARTING' | 'ERROR';
    startTime: number;
    broadcastState: {
        active: boolean;
        target: 'all' | 'parents' | 'children';
    };
    addUserStep: 'none' | 'name' | 'id';
    newUserData: { name?: string; id?: string };
}

const state: AdminState = {
    tunnelProcess: null,
    tunnelUrl: null,
    tunnelStatus: 'INACTIVE',
    startTime: Date.now(),
    broadcastState: { active: false, target: 'all' },
    addUserStep: 'none',
    newUserData: {}
};

// --- Helpers ---

const getUptime = () => {
    const uptime = Date.now() - state.startTime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    return `${hours}ч ${minutes}м`;
};

const loadProxyConfig = () => {
    try {
        if (fs.existsSync(PROXY_CONFIG_PATH)) {
            const content = fs.readFileSync(PROXY_CONFIG_PATH, 'utf8').trim();
            const parts = content.split(':');
            if (parts.length >= 4) {
                return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
            }
        }
    } catch (e) {
        console.error('Failed to load proxy config:', e);
    }
    return null;
};

const updateEnv = (url: string) => {
    try {
        [ENV_FILE, BACKEND_ENV_FILE].forEach(file => {
            if (fs.existsSync(file)) {
                let content = fs.readFileSync(file, 'utf8');
                content = content.includes('WEBAPP_URL=')
                    ? content.replace(/WEBAPP_URL=.*/, `WEBAPP_URL=${url}`)
                    : content + `\nWEBAPP_URL=${url}`;
                fs.writeFileSync(file, content);
            }
        });
        return true;
    } catch (e) {
        console.error('Failed to update env:', e);
        return false;
    }
};

const syncGlobalMenuButton = async (ctx: Context, url: string, bot: Bot) => {
    process.env.WEBAPP_URL = url;
    try {
        await bot.api.setChatMenuButton({
            menu_button: { type: 'web_app', text: 'Famili 🏠✨', web_app: { url } }
        });
    } catch (e) { console.error('❌ Failed default menu sync:', e); }

    const users = await prisma.user.findMany();
    let successCount = 0;
    for (const user of users) {
        try {
            await bot.api.setChatMenuButton({
                chat_id: parseInt(user.telegramId),
                menu_button: { type: 'web_app', text: 'Famili 🏠✨', web_app: { url } }
            });
            successCount++;
        } catch { }
    }
    try {
        await ctx.reply(`✅ <b>Кнопка обновлена у всех (${successCount}) пользователей!</b>`, { parse_mode: 'HTML' });
    } catch { }
};

const startTunnel = async (ctx: Context, bot: Bot) => {
    if (state.tunnelStatus === 'ACTIVE' || state.tunnelStatus === 'STARTING') return;
    state.tunnelStatus = 'STARTING';
    await ctx.editMessageText('🔄 <b>Запуск туннеля...</b>', { parse_mode: 'HTML' }).catch(() => { });

    const env = { ...process.env };
    const proxyUrl = loadProxyConfig();
    if (proxyUrl) {
        env.HTTP_PROXY = proxyUrl; env.HTTPS_PROXY = proxyUrl; env.TUNNEL_HTTP_PROXY = proxyUrl;
    }

    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(cmd, ['-y', 'cloudflared', 'tunnel', '--url', 'http://localhost:3000'], {
        cwd: ROOT_DIR, shell: true, env
    });
    state.tunnelProcess = child;

    const handleOutput = (data: Buffer) => {
        const text = data.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match) {
            const url = match[0];
            if (state.tunnelUrl !== url) {
                state.tunnelUrl = url;
                state.tunnelStatus = 'ACTIVE';
                updateEnv(url);
                syncGlobalMenuButton(ctx, url, bot);
                renderDashboard(ctx).catch(() => { });
            }
        }
    };
    child.stderr?.on('data', handleOutput);
    child.stdout?.on('data', handleOutput);
    setTimeout(() => { if (state.tunnelStatus === 'STARTING') renderDashboard(ctx).catch(() => { }); }, 5000);
};

const stopTunnel = async (ctx: Context) => {
    if (state.tunnelProcess) {
        if (process.platform === 'win32') spawn('taskkill', ['/pid', state.tunnelProcess.pid?.toString()!, '/f', '/t']);
        else state.tunnelProcess.kill();
        state.tunnelProcess = null;
    }
    state.tunnelStatus = 'INACTIVE';
    state.tunnelUrl = null;
    await renderDashboard(ctx);
};

// --- Views ---

const renderDashboard = async (ctx: Context) => {
    const userCount = await prisma.user.count();
    const tunnelIcon = state.tunnelStatus === 'ACTIVE' ? '🟢' : state.tunnelStatus === 'STARTING' ? '🟡' : '🔴';
    const text = `<b>⚡ ПАНЕЛЬ УПРАВЛЕНИЯ</b>\n\n<b>📊 Состояние</b>\n• Время: <code>${getUptime()}</code>\n• Юзеры: <code>${userCount}</code>\n\n<b>📡 Туннель:</b> ${tunnelIcon}\n${state.tunnelUrl ? `• <a href="${state.tunnelUrl}">${state.tunnelUrl}</a>` : ''}`;

    const kb = new InlineKeyboard()
        .text(state.tunnelStatus === 'ACTIVE' ? '🛑 СТОП Туннель' : '🚀 ПУСК Туннель', state.tunnelStatus === 'ACTIVE' ? 'admin_tunnel_stop' : 'admin_tunnel_start').row()
        .text('👥 Юзеры', 'admin_users').text('📢 Рассылка', 'admin_broadcast_menu').row()
        .text('👑 Админы', 'admin_users_admins').text('⚙️ Система', 'admin_system_menu').row();

    try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
    } catch {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
    }
};

const renderSystemMenu = async (ctx: Context) => {
    const kb = new InlineKeyboard()
        .text('🔄 Обновить', 'admin_dashboard').text('☁️ Git Push', 'admin_git_push').row()
        .text('🏗️ Build', 'admin_build').text('🔁 Рестарт', 'admin_restart').row()
        .text('🔙 Назад', 'admin_dashboard');
    await ctx.editMessageText('⚙️ <b>СИСТЕМА</b>', { parse_mode: 'HTML', reply_markup: kb });
};

const renderBroadcastMenu = async (ctx: Context) => {
    const kb = new InlineKeyboard()
        .text('👨‍👩‍👧‍👦 Все', 'admin_broadcast_ask_all').row()
        .text('👑 Родители', 'admin_broadcast_ask_parents').row()
        .text('👶 Дети', 'admin_broadcast_ask_children').row()
        .text('🔙 Назад', 'admin_dashboard');
    await ctx.editMessageText('📢 <b>РАССЫЛКА</b>', { parse_mode: 'HTML', reply_markup: kb });
};

const renderUserList = async (ctx: Context, page = 0, filter: 'all' | 'admin' = 'all') => {
    const USERS_PER_PAGE = 5;
    const where = filter === 'admin' ? { isAdmin: true } : {};
    const users = await prisma.user.findMany({ where, skip: page * USERS_PER_PAGE, take: USERS_PER_PAGE, orderBy: { id: 'asc' } });
    const total = await prisma.user.count({ where });

    let text = filter === 'admin' ? '👑 <b>АДМИНЫ</b>' : '👥 <b>ЮЗЕРЫ</b>';
    const kb = new InlineKeyboard();
    if (filter === 'all') kb.text('➕ Добавить', 'admin_user_add_start').row();

    users.forEach(u => kb.text(`${u.isAdmin ? '👮‍♂️' : u.role === 'parent' ? '👑' : '👶'} ${u.name}`, `admin_user_edit_${u.id}`).row());

    const max = Math.ceil(total / USERS_PER_PAGE) - 1;
    if (page > 0) kb.text('⬅️', `admin_users_page_${page - 1}_${filter}`);
    kb.text(`${page + 1}/${max + 1}`, 'noop');
    if (page < max) kb.text('➡️', `admin_users_page_${page + 1}_${filter}`);
    kb.row().text('🔙 Назад', 'admin_dashboard');
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
};

const renderUserEdit = async (ctx: Context, userId: number) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return renderUserList(ctx);
    const text = `👤 <b>${user.name}</b>\nID: <code>${user.telegramId}</code>\nБаллы: <b>${user.points}</b>`;
    const kb = new InlineKeyboard()
        .text('-10', `admin_pts_${userId}_-10`).text('-1', `admin_pts_${userId}_-1`).text('+1', `admin_pts_${userId}_1`).text('+10', `admin_pts_${userId}_10`).row()
        .text(user.isAdmin ? '⬇️ Снять Админа' : '⬆️ Сделать Админом', `admin_prom_${userId}_${user.isAdmin ? 'user' : 'admin'}`).row()
        .text('❌ УДАЛИТЬ', `admin_del_ask_${userId}`).row().text('🔙 Назад', 'admin_users');
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
};

const executeCommand = async (ctx: Context, command: string, title: string) => {
    await ctx.editMessageText(`⏳ <b>${title}...</b>`, { parse_mode: 'HTML' });
    exec(command, { cwd: ROOT_DIR }, async (err, stdout, stderr) => {
        const res = err ? `❌ Ошибка:\n${stderr || err.message}` : `✅ Ок:\n${stdout}`;
        const kb = new InlineKeyboard().text('🔙 Назад', 'admin_system_menu');
        await ctx.reply(`<pre>${res.substring(0, 1000)}</pre>`, { parse_mode: 'HTML', reply_markup: kb }).catch(() => { });
    });
};

const restartServer = async (ctx: Context, bot: Bot) => {
    await ctx.reply('👋 <b>Рестарт...</b>\n\nОкно откроется через 3 сек.', { parse_mode: 'HTML' });
    const args = ['/c', 'start', 'cmd.exe', '/k', 'ping 127.0.0.1 -n 4 > nul && node dist/index.js'];
    const child = spawn('cmd.exe', args, { cwd: path.resolve(__dirname, '../../'), detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();

    try {
        const stop = bot.stop();
        const timeout = new Promise(r => setTimeout(r, 1000));
        await Promise.race([stop, timeout]);
    } catch { }
    process.exit(0);
};

// --- Router ---

export const registerAdmin = (bot: Bot, adminIds: string[]) => {

    // Safety check for all admin requests
    const checkAccess = async (ctx: Context) => {
        const id = ctx.from?.id.toString();
        if (!id) return false;
        if (adminIds.includes(id)) return true;
        const u = await prisma.user.findUnique({ where: { telegramId: id } });
        return !!(u && u.isAdmin);
    };

    bot.command('admin', async (ctx, next) => {
        if (!await checkAccess(ctx)) {
            return ctx.reply(`⛔ Доступ запрещен. Ваш ID: <code>${ctx.from?.id}</code>`, { parse_mode: 'HTML' });
        }
        state.broadcastState.active = false; state.addUserStep = 'none';
        await renderDashboard(ctx);
    });

    bot.on('message:text', async (ctx, next) => {
        // Only trigger if an admin flow is active
        if (!state.broadcastState.active && state.addUserStep === 'none') return next();
        if (!await checkAccess(ctx)) return next();

        const text = ctx.message.text.trim();
        if (state.broadcastState.active) {
            const users = await prisma.user.findMany();
            const target = state.broadcastState.target;
            const recp = users.filter(u => target === 'all' ? true : target === 'parents' ? u.role === 'parent' : u.role === 'child');
            let s = 0;
            for (const u of recp) { try { await bot.api.sendMessage(u.telegramId, `📢 ${text}`); s++; } catch { } }
            state.broadcastState.active = false;
            return ctx.reply(`✅ Отправлено: ${s}/${recp.length}`, { reply_markup: new InlineKeyboard().text('🔙 В панель', 'admin_dashboard') });
        }

        if (state.addUserStep === 'name') {
            state.newUserData.name = text; state.addUserStep = 'id';
            return ctx.reply('👤 ID пользователя?');
        }
        if (state.addUserStep === 'id') {
            try {
                await prisma.user.create({ data: { name: state.newUserData.name!, telegramId: text, role: 'child' } });
                state.addUserStep = 'none';
                return ctx.reply('✅ Добавлен!', { reply_markup: new InlineKeyboard().text('👥 Список', 'admin_users') });
            } catch { state.addUserStep = 'none'; return ctx.reply('❌ Ошибка (ID занят)'); }
        }
        return next();
    });

    bot.on('callback_query:data', async (ctx, next) => {
        const data = ctx.callbackQuery.data;
        if (!data.startsWith('admin_')) return next();
        if (!await checkAccess(ctx)) return ctx.answerCallbackQuery({ text: '⛔ Отказано', show_alert: true });

        if (data === 'admin_dashboard') { state.broadcastState.active = false; state.addUserStep = 'none'; return renderDashboard(ctx); }
        if (data === 'admin_tunnel_start') return startTunnel(ctx, bot);
        if (data === 'admin_tunnel_stop') return stopTunnel(ctx);
        if (data === 'admin_system_menu') return renderSystemMenu(ctx);
        if (data === 'admin_git_push') return executeCommand(ctx, 'git add . && git commit -m "Update" && git push', 'Git Push');
        if (data === 'admin_build') return executeCommand(ctx, 'npm run build', 'Build');
        if (data === 'admin_restart') return restartServer(ctx, bot);
        if (data === 'admin_broadcast_menu') return renderBroadcastMenu(ctx);
        if (data.startsWith('admin_broadcast_ask_')) {
            state.broadcastState = { active: true, target: data.split('_')[3] as any };
            return ctx.editMessageText('📝 <b>Текст рассылки?</b>', { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🔙 Отмена', 'admin_dashboard') });
        }
        if (data === 'admin_users') return renderUserList(ctx, 0, 'all');
        if (data === 'admin_users_admins') return renderUserList(ctx, 0, 'admin');
        if (data === 'admin_user_add_start') {
            state.addUserStep = 'name'; return ctx.editMessageText('👤 <b>Имя юзера?</b>', { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🔙 Отмена', 'admin_users') });
        }
        if (data.startsWith('admin_users_page_')) {
            const p = data.split('_'); return renderUserList(ctx, parseInt(p[3]), p[4] as any);
        }
        if (data.startsWith('admin_user_edit_')) return renderUserEdit(ctx, parseInt(data.split('_')[3]));
        if (data.startsWith('admin_pts_')) {
            const p = data.split('_'); await prisma.user.update({ where: { id: parseInt(p[2]) }, data: { points: { increment: parseInt(p[3]) } } });
            return renderUserEdit(ctx, parseInt(p[2]));
        }
        if (data.startsWith('admin_prom_')) {
            const p = data.split('_'); await prisma.user.update({ where: { id: parseInt(p[2]) }, data: { isAdmin: p[3] === 'admin' } });
            return renderUserEdit(ctx, parseInt(p[2]));
        }
        if (data.startsWith('admin_del_ask_')) {
            const id = data.split('_')[3];
            return ctx.editMessageText('⚠️ <b>Удалить?</b>', { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('✅ ДА', `admin_del_conf_${id}`).text('🚫 НЕТ', `admin_user_edit_${id}`) });
        }
        if (data.startsWith('admin_del_conf_')) {
            await prisma.user.delete({ where: { id: parseInt(data.split('_')[3]) } });
            return renderUserList(ctx, 0);
        }
        await ctx.answerCallbackQuery();
    });
};
