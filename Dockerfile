# Stage 1: Build React SPA
# vite.config.ts sets build.outDir: '../app/static/spa' relative to /frontend → /app/static/spa
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN mkdir -p /app/static/spa && npm run build

# Stage 2: Python application
FROM python:3.12-slim

WORKDIR /app

# Install deps first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Copy built SPA from stage 1 (Vite wrote to /app/static/spa in stage 1)
COPY --from=frontend-build /app/static/spa/ ./app/static/spa/

RUN addgroup --system app && adduser --system --ingroup app app
USER app

# Cloud Run injects PORT; fall back to 8080 locally
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
