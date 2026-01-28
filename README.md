# GeoHadir - Aplikasi Absensi Berbasis GPS

GeoHadir adalah sebuah sistem absensi karyawan berbasis GPS yang modern. Proyek ini dibangun dengan arsitektur Monorepo yang terdiri dari tiga bagian utama: Backend API, Aplikasi Mobile untuk karyawan, dan Web Admin untuk manajemen.

Fitur utama dari sistem ini adalah validasi absensi berdasarkan radius lokasi (Geofencing), di mana karyawan hanya bisa melakukan absensi (check-in) jika berada dalam jarak yang telah ditentukan (misal, 50 meter) dari lokasi kantor.

## 🚀 Teknologi yang Digunakan

-   **Monorepo**: Mengelola beberapa project dalam satu repository.
-   **Backend API**:
    -   Framework: **Node.js** & **Express**
    -   Deployment: **Vercel**
-   **Aplikasi Mobile (Karyawan)**:
    -   Framework: **React Native** dengan **Expo**
-   **Web Admin**:
    -   Framework: **Next.js**
-   **Database**:
    -   **Supabase** (PostgreSQL) untuk database dan autentikasi.
-   **Styling**:
    -   **Tailwind CSS** untuk Web Admin.
    -   **NativeWind** (Tailwind untuk React Native) untuk Aplikasi Mobile.

## 📂 Struktur Monorepo

Struktur folder utama project ini adalah sebagai berikut:

```
geohadir/
├── api-geohadir/          # Backend API (Node.js + Express)
├── mobile-geohadir/       # Aplikasi Mobile (React Native + Expo)
└── web-geohadir/          # Web Admin (Next.js)
```

## 🛠️ Panduan Setup & Instalasi

### Prasyarat

-   [Node.js](https://nodejs.org/) (v18 atau lebih baru)
-   [Akun Supabase](https://supabase.com/)
-   [Akun Vercel](https://vercel.com/) & [Vercel CLI](https://vercel.com/docs/cli)
-   Aplikasi **Expo Go** di HP Anda untuk testing mobile.

### 1. Konfigurasi Awal

1.  **Clone Repository**:
    ```bash
    git clone https://github.com/alchemista27/geohadir.git
    cd geohadir
    ```

2.  **Setup Database Supabase**:
    -   Buat project baru di Supabase.
    -   Buka **SQL Editor** dan jalankan query untuk membuat tabel `offices` dan `attendance_logs`.
    -   Ambil **URL Project**, **Anon Key**, dan **Service Role Key** dari Supabase Dashboard (Settings -> API).

### 2. Setup Backend API (`/api-geohadir`)

1.  **Environment Variables**:
    Buat file `.env` di dalam folder `api-geohadir/`.
    ```env
    # api/.env
    SUPABASE_URL=https://<your-project-id>.supabase.co
    SUPABASE_SERVICE_KEY=<your-supabase-service-role-key>
    ```

2.  **Install & Jalankan**:
    ```bash
    cd api-geohadir
    npm install
    node index.js
    ```
    API akan berjalan di `http://localhost:3000`.

3.  **Deploy ke Vercel**:
    Hubungkan repository GitHub Anda ke Vercel. Saat konfigurasi, pastikan untuk mengatur **Root Directory** ke `api/` dan menambahkan Environment Variables di dashboard Vercel.

### 3. Setup Aplikasi Mobile (`/mobile-geohadir`)

1.  **Environment Variables**:
    Buat file `.env` di dalam folder `mobile-geohadir/`. Ganti URL API dengan URL Vercel Anda setelah deploy.
    ```env
    # mobile/.env
    EXPO_PUBLIC_API_URL=https://<your-api-url>.vercel.app
    EXPO_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
    EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
    ```

2.  **Install & Jalankan**:
    ```bash
    cd mobile-geohadir
    npm install
    npx expo start
    ```
    Scan QR code yang muncul menggunakan aplikasi Expo Go di HP Anda.

### 4. Setup Web Admin (`/web-geohadir`)

1.  **Install & Jalankan**:
    ```bash
    cd web-geohadir
    npm install
    npm run dev
    ```
    Web Admin akan berjalan di `http://localhost:3001` (atau port lain yang tersedia).