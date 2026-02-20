FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
# Place shared packages where wrapper modules expect them
RUN if [ -d _common ]; then mkdir -p /packages && mv _common /packages/common; fi
EXPOSE 3200
CMD ["node", "server.js"]
