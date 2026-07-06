# --- Build stage: compile the Vite app ---
FROM node:22-alpine AS build
WORKDIR /app

# Install deps (includes devDeps: tsc + vite are needed to build).
# `npm install` rather than `npm ci`: rolldown's cross-platform native bindings
# (@emnapi/*) aren't fully recorded in a macOS-generated lockfile, which makes the
# strict `npm ci` fail on linux. `npm install` resolves what this platform needs.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# Build the static bundle into /app/dist (runs `tsc --noEmit && vite build`)
COPY . .
RUN npm run build

# --- Serve stage: static files behind nginx with SPA fallback ---
FROM nginx:alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
