FROM ghcr.io/puppeteer/puppeteer:22.12.1

WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем зависимости как pptruser (без проблем с правами)
USER pptruser
RUN npm ci

# Копируем проект
COPY --chown=pptruser:pptruser . .

# Если используешь puppeteer-core — задай путь к Chrome
# (для puppeteer это не обязательно, но не мешает)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Render задаёт PORT сам; сервер использует process.env.PORT
EXPOSE 3000

CMD ["npm", "start"]