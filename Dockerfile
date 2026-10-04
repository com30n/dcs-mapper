FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.13-alpine AS build
WORKDIR /src
COPY tools/build_site.py tools/
COPY aircraft/ aircraft/
COPY devices/ devices/
COPY locales/ locales/
COPY --from=web /src/web/dist web/dist/
RUN python tools/build_site.py --out /build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/ /usr/share/nginx/html/
EXPOSE 8080
