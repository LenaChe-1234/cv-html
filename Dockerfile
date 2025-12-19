# 1. Base image with Chrome and Puppeteer preinstalled
FROM ghcr.io/puppeteer/puppeteer:22.12.1

# 2. Switch to root user to install dependencies and manage permissions
USER root

# 3. Set the working directory inside the container
WORKDIR /app

# 4. Copy package.json and package-lock.json (if present)
COPY package*.json ./

# 5. Install Node.js dependencies using ci for reproducibility
RUN npm ci

# 6. Copy the rest of the project files into the container
COPY . .

# 7. Grant ownership of the /app directory to the non-root user
RUN chown -R pptruser:pptruser /app

# 8. Switch back to the non-root user for security reasons
USER pptruser

# 9. Expose the application port (Render will override via $PORT)
ENV PORT=3000

# 10. Start the application
CMD ["npm", "start"]