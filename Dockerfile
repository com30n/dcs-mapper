FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
COPY aircraft/ ../aircraft/
COPY devices/ ../devices/
COPY locales/ ../locales/
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web /src/web/dist/ /usr/share/nginx/html/
EXPOSE 8080
