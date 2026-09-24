FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY api/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy project modules needed by API
COPY api /app
COPY agent /agent
COPY mcp /mcp
COPY data /data
COPY cases /cases

ENV PYTHONPATH="/app:/agent:/mcp:/"
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
