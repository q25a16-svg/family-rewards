import { Command } from 'commander';
import chalk from 'chalk';
import prisma from '../db/client.js';

const program = new Command();

program
    .name('family-cli')
    .description('Control panel for Family Rewards App')
    .version('1.0.0');

const users = program.command('users').description('User management');

users
    .command('add')
    .description('Add a new user')
    .argument('<role>', 'parent or child')
    .argument('<tgId>', 'Telegram ID')
    .argument('<name>', 'User name')
    .action(async (role, tgId, name) => {
        try {
            const user = await prisma.user.create({
                data: {
                    telegramId: tgId,
                    name,
                    role: role.toLowerCase() === 'parent' ? 'parent' : 'child',
                },
            });
            console.log(chalk.green(`✔ User ${user.name} (${user.role}) added successfully!`));
        } catch (error: any) {
            console.log(chalk.red(`✖ Error: ${error.message}`));
        }
    });

users
    .command('list')
    .description('List all users')
    .action(async () => {
        const allUsers = await prisma.user.findMany();
        console.log(chalk.blue('\n--- User List ---'));
        allUsers.forEach((u: any) => {
            console.log(`${u.role === 'parent' ? '👑' : '👶'} ${chalk.bold(u.name)} [ID: ${u.telegramId}] - Points: ${u.points}`);
        });
        console.log(chalk.blue('-----------------\n'));
    });

users
    .command('delete')
    .description('Delete user by Telegram ID')
    .argument('<tgId>', 'Telegram ID of the user to delete')
    .action(async (tgId) => {
        try {
            await prisma.user.delete({ where: { telegramId: tgId } });
            console.log(chalk.green(`✔ User ${tgId} deleted successfully!`));
        } catch (error: any) {
            console.log(chalk.red(`✖ Error: ${error.message}`));
        }
    });

program.parse();
