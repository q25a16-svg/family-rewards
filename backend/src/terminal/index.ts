import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import chalk from 'chalk';
import readline from 'readline';
import { fileURLToPath } from 'url';
import prisma from '../db/client.js';
import http from 'http';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const BACKEND_ENV_FILE = path.join(ROOT_DIR, 'backend/.env');

// --- State ---
interface ServiceState {
    backend: ChildProcess | null;
    tunnel: ChildProcess | null;
    lastTunnelUrl: string | null;
    statusBackend: 'ONLINE' | 'OFFLINE' | 'STARTING' | 'ERROR';
    statusTunnel: 'ACTIVE' | 'INACTIVE' | 'STARTING' | 'ERROR';
    logs: string[];
    isHeartbeatActive: boolean;
    isFlowActive: boolean;
}

const state: ServiceState = {
    backend: null,
    tunnel: null,
    lastTunnelUrl: null,
    statusBackend: 'OFFLINE',
    statusTunnel: 'INACTIVE',
    logs: [],
    isHeartbeatActive: false,
    isFlowActive: false
};

// --- UI THEME (ULTIMATE PREMIUM) ---
const THEME = {
    primary: chalk.hex('#00F2FF'), // Cyber Cyan
    secondary: chalk.hex('#FF00E5'), // Neon Pink
    accent: chalk.hex('#7000FF'), // Deep Purple
    success: chalk.hex('#00FF9D').bold, // Matrix Green
    warning: chalk.hex('#FFE600'), // Gold
    error: chalk.hex('#FF3131').bold, // Blood Red
    gray: chalk.gray,
    white: chalk.white.bold,
    bg: chalk.bgBlack,
    width: 80
};

const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    state.logs.push(`[${THEME.gray(time)}] ${msg}`);
    if (state.logs.length > 5) state.logs.shift();
};

const clearScreen = () => {
    process.stdout.write('\x1Bc');
};

const center = (text: string, width = THEME.width - 6) => {
    const cleanText = text.replace(/\u001b\[.*?m/g, ''); // strip colors for calculation
    const totalPadding = Math.max(0, width - cleanText.length);
    const leftPadding = Math.floor(totalPadding / 2);
    const rightPadding = totalPadding - leftPadding;
    return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
};

// --- LOGIC ---

const checkBackendHealth = () => {
    if (state.isHeartbeatActive) return;
    state.isHeartbeatActive = true;

    setInterval(() => {
        // If we shouldn't redraw, don't even ping to avoid race conditions
        if (state.isFlowActive) return;

        const req = http.get('http://localhost:3000/ping', (res) => {
            if (res.statusCode === 200) {
                if (state.statusBackend !== 'ONLINE') {
                    state.statusBackend = 'ONLINE';
                    addLog(THEME.success('Связь с Backend установлена'));
                    renderDashboard();
                }
            } else {
                if (state.statusBackend !== 'ERROR') {
                    state.statusBackend = 'ERROR';
                    addLog(THEME.error(`Ядро Backend вернуло код: ${res.statusCode}`));
                    renderDashboard();
                }
            }
        });

        req.on('error', () => {
            if (state.statusBackend === 'ONLINE') {
                state.statusBackend = 'OFFLINE';
                addLog(THEME.error('Связь с Backend потеряна'));
                renderDashboard();
            }
        });

        req.end();
    }, 5000);
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
        addLog(THEME.success('Конфигурация .env успешно обновлена'));
        return true;
    } catch (e) {
        addLog(THEME.error('Ошибка записи переменных окружения'));
        return false;
    }
};

const stopProcess = (proc: ChildProcess | null, name: string) => {
    if (!proc) return;
    try {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', proc.pid?.toString()!, '/f', '/t']);
        } else {
            proc.kill();
        }
    } catch (e) {
        addLog(THEME.error(`Критический сбой при остановке ${name}`));
    }
};

const startBackend = () => {
    if (state.backend) stopProcess(state.backend, 'Backend');
    state.statusBackend = 'STARTING';
    addLog(THEME.warning('Запуск ядра Backend...'));
    renderDashboard();

    const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(cmd, ['run', 'dev', '--prefix', 'backend'], {
        cwd: ROOT_DIR,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '1' }
    });

    state.backend = child;
    addLog(THEME.success('Backend запущен. Ожидание ответа шлюза...'));
    renderDashboard();
};

const startTunnel = () => {
    if (state.tunnel) stopProcess(state.tunnel, 'Tunnel');
    state.statusTunnel = 'STARTING';
    addLog(THEME.warning('Развертывание защищенного туннеля...'));
    renderDashboard();

    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(cmd, ['cloudflared', 'tunnel', '--url', 'http://localhost:3000'], {
        cwd: ROOT_DIR,
        shell: true
    });

    state.tunnel = child;
    state.statusTunnel = 'ACTIVE';

    child.stderr?.on('data', (data) => {
        const text = data.toString();
        const match = text.match(/https:\/\/[\w-]+\.trycloudflare\.com/);
        if (match) {
            const url = match[0];
            if (state.lastTunnelUrl !== url) {
                state.lastTunnelUrl = url;
                updateEnv(url);
                addLog(THEME.success(`Туннель запущен: ${url}`));
                startBackend();
            }
        }
    });

    renderDashboard();
};

const stopAll = () => {
    stopProcess(state.backend, 'Backend');
    stopProcess(state.tunnel, 'Tunnel');
    state.backend = null;
    state.tunnel = null;
    state.statusBackend = 'OFFLINE';
    state.statusTunnel = 'INACTIVE';
    addLog(THEME.gray('Система переведена в спящий режим.'));
    renderDashboard();
};

// --- DB HELPERS ---

const askQuestion = (query: string): Promise<string> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
};

const addUserFlow = async () => {
    state.isFlowActive = true;
    clearScreen();
    console.log(THEME.secondary('\n   ┌──────────────────────────────────────────────────────────┐'));
    console.log(THEME.secondary('   │             ДОБАВЛЕНИЕ НОВОГО ПОЛЬЗОВАТЕЛЯ               │'));
    console.log(THEME.secondary('   └──────────────────────────────────────────────────────────┘\n'));

    const name = await askQuestion(`   ${THEME.white('👤 Имя пользователя: ')}`);
    const tgId = await askQuestion(`   ${THEME.white('🆔 Telegram ID: ')}`);
    const roleChoice = await askQuestion(`   ${THEME.white('🎭 Роль (1 - Родитель, 2 - Ребенок): ')}`);

    const role = roleChoice === '1' ? 'parent' : 'child';

    try {
        await prisma.user.create({
            data: {
                name,
                telegramId: tgId,
                role,
                points: 0
            }
        });
        addLog(THEME.success(`Пользователь ${name} успешно создан`));
    } catch (e) {
        addLog(THEME.error('Ошибка при создании пользователя в БД'));
    }
    state.isFlowActive = false;
};

const deleteUserFlow = async () => {
    state.isFlowActive = true;
    const users = await prisma.user.findMany();
    if (users.length === 0) {
        addLog(THEME.warning('В базе данных нет пользователей'));
        state.isFlowActive = false;
        return;
    }

    clearScreen();
    console.log(THEME.error('\n   ┌──────────────────────────────────────────────────────────┐'));
    console.log(THEME.error('   │            УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ (ВНИМАНИЕ)              │'));
    console.log(THEME.error('   └──────────────────────────────────────────────────────────┘\n'));

    users.forEach((u, i) => {
        console.log(`   [ ${THEME.white(i + 1)} ] ${u.name.padEnd(20)} | ID: ${u.telegramId}`);
    });

    const choice = await askQuestion(`\n   ${THEME.white('Введите номер для удаления (или 0 для отмены): ')}`);
    const idx = parseInt(choice) - 1;

    if (idx >= 0 && idx < users.length) {
        try {
            await prisma.user.delete({ where: { id: users[idx].id } });
            addLog(THEME.success(`Пользователь ${users[idx].name} удален`));
        } catch (e) {
            addLog(THEME.error('Ошибка при удалении пользователя'));
        }
    }
    state.isFlowActive = false;
};

// --- RENDERER ---
const renderDashboard = () => {
    if (state.isFlowActive) return;
    clearScreen();
    console.log('\n');
    console.log(THEME.primary('   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'));
    console.log('   ┃' + center(THEME.white('⚡ SERVICE MANAGER DELUXE ⚡ v4.5.0'), 70) + '┃');
    console.log('   ┃' + center(THEME.primary('FAMILI REWARDS - ПАНЕЛЬ УПРАВЛЕНИЯ СИСТЕМОЙ'), 70) + '┃');
    console.log('   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');

    console.log('\n   ' + THEME.secondary('◈ МОНИТОРИНГ СЕТИ И РЕСУРСОВ'));

    const bStatus = state.statusBackend === 'ONLINE' ? THEME.success('● В СЕТИ  ') :
        state.statusBackend === 'STARTING' ? THEME.warning('○ ЗАПУСК  ') : THEME.gray('○ ВЫКЛЮЧЕН');
    const tStatus = state.statusTunnel === 'ACTIVE' ? THEME.success('● АКТИВЕН ') : THEME.gray('○ НЕАКТИВЕН');

    console.log(`   📂 Ядро Backend: [ ${bStatus} ]    📡 Туннель Cloudflare: [ ${tStatus} ]`);

    if (state.lastTunnelUrl) {
        console.log(`   🔗 Внешняя ссылка: ${THEME.warning(state.lastTunnelUrl)}`);
    } else {
        console.log(`   🔗 Внешняя ссылка: ${THEME.gray('ожидание генерации туннеля...')}`);
    }

    console.log('\n   ' + THEME.secondary('◈ ЖУРНАЛ СОБЫТИЙ'));
    state.logs.forEach(log => console.log(`   ${log}`));
    if (state.logs.length === 0) console.log(`   ${THEME.gray('системный журнал пуст...')}`);

    console.log('\n   ' + THEME.accent('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'));
    console.log('   ┃' + THEME.white(' [ 1 ] ПОЛНЫЙ ЗАПУСК   ') + THEME.gray(' |  Активация всех сервисов и туннеля     ') + THEME.accent('┃'));
    console.log('   ┃' + THEME.white(' [ 2 ] ОСТАНОВИТЬ ВСЁ  ') + THEME.gray(' |  Мгновенное завершение всех процессов   ') + THEME.accent('┃'));
    console.log('   ┃' + THEME.white(' [ 3 ] БАЗА ДАННЫХ     ') + THEME.gray(' |  Просмотр списка зарегистрированных лиц ') + THEME.accent('┃'));
    console.log('   ┃' + THEME.white(' [ 4 ] НОВЫЙ ПОЛЬЗОВАТЕЛЬ') + THEME.gray(' |  Добавление участника в систему Famili  ') + THEME.accent('┃'));
    console.log('   ┃' + THEME.white(' [ 5 ] УДАЛИТЬ ЛИЦО    ') + THEME.gray(' |  Удаление записи пользователя из БД     ') + THEME.accent('┃'));
    console.log('   ┃' + THEME.white(' [ 0 ] ЗАВЕРШИТЬ СЕССИЮ') + THEME.gray(' |  Выход из менеджера управления          ') + THEME.accent('┃'));
    console.log('   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');

    process.stdout.write(`\n   ${THEME.primary('❯')} ${THEME.white('Выберите действие: ')}`);
};

// --- INPUT ---
const setupInput = () => {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    process.stdin.on('keypress', async (str, key) => {
        if (state.isFlowActive) return;

        if (key.ctrl && key.name === 'c') {
            stopAll();
            process.exit();
        }

        switch (key.name) {
            case '1':
                startTunnel();
                break;
            case '2':
                stopAll();
                break;
            case '3':
                state.isFlowActive = true;
                process.stdin.setRawMode(false);
                const allUsers = await prisma.user.findMany();
                clearScreen();
                console.log(THEME.primary('\n\n   --- СПИСОК ПОЛЬЗОВАТЕЛЕЙ / DATABASE EXPLORER ---'));
                console.log('   ' + '━'.repeat(60));
                allUsers.forEach(u => {
                    const icon = u.role === 'parent' ? '👑' : '👶';
                    console.log(`   ${icon} ${u.name.padEnd(15)} | Очки: ${String(u.points).padEnd(5)} | TG: ${u.telegramId}`);
                });
                console.log('   ' + '━'.repeat(60));
                console.log('\n   Нажмите Enter, чтобы вернуться...');
                await new Promise(r => process.stdin.once('data', r));
                state.isFlowActive = false;
                process.stdin.setRawMode(true);
                renderDashboard();
                break;
            case '4':
                process.stdin.setRawMode(false);
                await addUserFlow();
                process.stdin.setRawMode(true);
                renderDashboard();
                break;
            case '5':
                process.stdin.setRawMode(false);
                await deleteUserFlow();
                process.stdin.setRawMode(true);
                renderDashboard();
                break;
            case '0':
                stopAll();
                process.exit();
        }
    });
};

const init = () => {
    if (fs.existsSync(ENV_FILE)) {
        const content = fs.readFileSync(ENV_FILE, 'utf8');
        const match = content.match(/WEBAPP_URL=(.*)/);
        if (match && match[1]) state.lastTunnelUrl = match[1].trim();
    }
    checkBackendHealth();
    addLog(THEME.gray('Интерфейс управления инициализирован.'));
    renderDashboard();
    setupInput();
};

init();
