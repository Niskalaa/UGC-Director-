# Menggunakan Python versi stabil dan ringan
FROM python:3.11-slim

# Mencegah Python menulis file .pyc dan memastikan log muncul segera
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Folder kerja di dalam server AWS
WORKDIR /app

# Install kebutuhan sistem untuk memproses gambar/video
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy daftar library dan install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy semua kode project kamu
COPY . .

# Port yang wajib dibuka untuk AWS App Runner
EXPOSE 8080

# Perintah untuk menyalakan aplikasi menggunakan Gunicorn (Standar Production)
# Ganti 'app:app' menjadi 'nama_file_kamu:app' (misal 'main:app')
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "app:app", "--timeout", "120"]
