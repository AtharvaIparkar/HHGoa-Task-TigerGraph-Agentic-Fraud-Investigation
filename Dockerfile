# Multi-stage Dockerfile: Frontend Build + FastAPI Unified Server
FROM node:20-alpine AS frontend-builder
WORKDIR /ui
COPY ui/package*.json ./
RUN npm install
COPY ui ./
RUN npm run build

# Python Server
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend and agent code
COPY api /app/api
COPY agent /app/agent
COPY mcp /app/mcp
COPY data /app/data
COPY cases /app/cases
COPY mock-action-service /app/mock-action-service

# Copy prebuilt/builder UI distribution
COPY --from=frontend-builder /ui/dist /app/ui/dist

ENV PYTHONPATH="/app:/app/agent:/app/mcp"
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
