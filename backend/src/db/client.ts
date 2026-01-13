import { PrismaClient } from '../generated-client/index.js'
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.platform === 'linux') {
    // Bothost uses Alpine (OpenSSL 3.0) but Prisma fails to detect it correctly (defaults to 1.1).
    // We force it to use the 3.0 binary we shipped.
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(__dirname, '../generated-client/libquery_engine-linux-musl-openssl-3.0.x.so.node');
}

const prisma = new PrismaClient()

export default prisma
