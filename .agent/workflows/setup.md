---
description: Полная инициализация проекта (Backend + Frontend)
---

Этапы подготовки окружения:

// turbo
1. Установка зависимостей бэкенда и настройка БД
```powershell
cd backend && npm install && npx prisma generate && npx prisma migrate dev --name init
```

// turbo
2. Установка зависимостей фронтенда
```powershell
cd frontend && npm install
```

3. Запуск проекта (Бэкенд)
```powershell
cd backend && npm run dev
```

4. Запуск проекта (Фронтенд)
```powershell
cd frontend && npm run dev
```
