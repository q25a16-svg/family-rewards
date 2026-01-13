import { PrismaClient } from '../generated-client/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// No longer hardcoding linux-musl target - Prisma will auto-detect from schema.prisma
const prisma = new PrismaClient();
export default prisma;
