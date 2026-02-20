FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY src ./src
COPY index.html ./
COPY vite.config.js ./
RUN npm install
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
