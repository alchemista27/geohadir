const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Inisialisasi Supabase Client
// Pastikan variabel environment sudah diset
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: Menghitung Jarak antara 2 koordinat (Haversine Formula)
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Jarak dalam meter
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Endpoint: Check-in Absensi
app.post('/api/check-in', async (req, res) => {
  const { userId, latitude, longitude } = req.body;

  // Validasi input dasar
  if (!userId || !latitude || !longitude) {
    return res.status(400).json({ error: 'Data tidak lengkap (userId, latitude, longitude)' });
  }

  try {
    // 1. Ambil Lokasi Kantor dari Database
    // Asumsi tabel 'offices' sudah dibuat di Supabase
    const { data: office, error: officeError } = await supabase
      .from('offices')
      .select('*')
      .single(); // Mengambil satu kantor (bisa disesuaikan jika multi-cabang)

    if (officeError || !office) {
      return res.status(500).json({ error: 'Konfigurasi kantor tidak ditemukan.' });
    }

    // 2. Hitung Jarak User ke Kantor
    const distance = getDistanceFromLatLonInMeters(
      latitude,
      longitude,
      office.latitude,
      office.longitude
    );

    // 3. Validasi Radius (Default 50 meter jika tidak diset di DB)
    const MAX_RADIUS = office.radius_meters || 50;

    if (distance > MAX_RADIUS) {
      return res.status(400).json({
        success: false,
        message: `Anda berada di luar jangkauan. Jarak: ${Math.round(distance)}m. Maksimal: ${MAX_RADIUS}m.`,
      });
    }

    // 4. Simpan Log Absensi jika valid
    const { error: logError } = await supabase
      .from('attendance_logs')
      .insert([
        {
          user_id: userId,
          check_in: new Date().toISOString(),
          lat: latitude,
          long: longitude,
          status: 'present',
        },
      ]);

    if (logError) throw logError;

    return res.status(200).json({
      success: true,
      message: 'Check-in berhasil!',
      distance: Math.round(distance),
    });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan internal server.' });
  }
});

// Root Endpoint untuk cek status server
app.get('/', (req, res) => {
  res.send('GeoHadir API is Running');
});

// Jalankan Server (Local Development)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Export app untuk Vercel
module.exports = app;
