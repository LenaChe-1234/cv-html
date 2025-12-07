# 1. Базовый образ с Chrome и Puppeteer
FROM ghcr.io/puppeteer/puppeteer:latest

# 2. Переходим на root, чтобы создать директорию и ставить зависимости
USER root

# 3. Рабочая директория
WORKDIR /app

# 4. Копируем package*.json (без ошибки, если нет package-lock)
COPY package*.json ./

# 5. Ставим зависимости
RUN npm install

# 6. Копируем остаток проекта
COPY . .

# 7. Выдаём права пользователю pptruser на /app
RUN chown -R pptruser:pptruser /app

# 8. Возвращаемся к безопасному пользователю
USER pptruser

# 9. Порт для приложения (Render подставит свой через $PORT)
ENV PORT=3000

# 10. Команда запуска
CMD ["npm", "start"]
