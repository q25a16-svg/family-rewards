import prisma from '../db/client.js';
async function main() {
    console.log('🌱 Seeding database...');
    // Create global tasks
    await prisma.task.createMany({
        data: [
            { title: 'Убрать игрушки', description: 'Собери все игрушки в корзину и наведи порядок в комнате.', reward: 100, isGlobal: true },
            { title: 'Помыть посуду', description: 'Помой посуду после ужина и протри стол.', reward: 150, isGlobal: true },
        ]
    });
    // Create shop items
    await prisma.storeItem.createMany({
        data: [
            { title: 'Мороженое', description: 'Вкусное шоколадное мороженое', price: 200 },
            { title: 'Час игры в приставку', description: 'Дополнительный час игры в любимую игру', price: 500 },
            { title: 'Поход в кино', description: 'Билет на любой мультфильм в эти выходные', price: 1000 },
        ]
    });
    console.log('✔ Seeding complete!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
