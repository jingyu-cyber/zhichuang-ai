FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chmod -R a+r /usr/share/nginx/html
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3   CMD wget -q --spider http://localhost:80 || exit 1
EXPOSE 80
