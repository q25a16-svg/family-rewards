#!/bin/sh

echo "🚀 Starting Famili Rewards Production..."

# Apply database migrations
echo "📦 Applying database migrations..."
cd /app/backend && npx prisma migrate deploy

# Start the application
echo "⚡ Launching application server..."
cd /app && node index.js
