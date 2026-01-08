FROM ghcr.io/puppeteer/puppeteer:22.12.1

WORKDIR /app

COPY package*.json ./

USER pptruser
RUN npm ci

COPY --chown=pptruser:pptruser . .

RUN npm run build

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

EXPOSE 3000

CMD ["npm", "start"]