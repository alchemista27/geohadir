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

// Helper: Validasi user ada di profiles table
async function validateUserExists(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single();
    
    if (error) {
      // PGRST116 = no rows returned; other errors = actual DB issues
      if (error.code === 'PGRST116') {
        return { exists: false, user: null };
      }
      throw error;
    }
    return { exists: !!data, user: data };
  } catch (err) {
    console.error('validateUserExists Error:', err);
    throw err;
  }
}

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

// Helper: Validasi latitude & longitude range
function isValidCoordinates(latitude, longitude) {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

// Helper: Get start & end of day (fix timezone issue)
function getDayBoundaries() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  endOfDay.setDate(endOfDay.getDate() + 1);
  return {
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString()
  };
}

// Helper: Check duplicate check-in hari ini
async function isDuplicateCheckInToday(userId) {
  const { startOfDay, endOfDay } = getDayBoundaries();

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id')
    .eq('user_id', userId)
    .gte('check_in', startOfDay)
    .lt('check_in', endOfDay)
    .is('check_out', null); // Belum check-out

  if (error) {
    console.error('isDuplicateCheckInToday Error:', error);
    return false; // Default: assume no duplicate on error
  }
  return data && data.length > 0;
}

// Endpoint: Check-in Absensi
app.post('/api/check-in', async (req, res) => {
  const { userId, latitude, longitude, officeId } = req.body;

  // Validasi input dasar
  if (!userId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ 
      success: false,
      error: 'Data tidak lengkap (userId, latitude, longitude dibutuhkan)' 
    });
  }

  // Validasi coordinate range
  if (!isValidCoordinates(latitude, longitude)) {
    return res.status(400).json({ 
      success: false,
      error: 'Koordinat tidak valid. Latitude: -90 to 90, Longitude: -180 to 180' 
    });
  }

  try {
    // 1. Validasi user ada di database
    const { exists: userExists, user } = await validateUserExists(userId);
    if (!userExists) {
      return res.status(400).json({ 
        success: false,
        error: 'User tidak ditemukan' 
      });
    }

    // 2. Cek sudah check-in hari ini
    const isDuplicate = await isDuplicateCheckInToday(userId);
    if (isDuplicate) {
      return res.status(400).json({ 
        success: false,
        error: 'Anda sudah melakukan check-in hari ini. Gunakan check-out untuk mengakhiri.' 
      });
    }

    // 3. Ambil Lokasi Kantor dari Database
    let office;
    if (officeId) {
      // Jika officeId diberikan, gunakan itu
      try {
        const { data, error: officeError } = await supabase
          .from('offices')
          .select('*')
          .eq('id', officeId)
          .single();
        
        if (officeError) {
          if (officeError.code === 'PGRST116') {
            return res.status(404).json({ 
              success: false,
              error: 'Kantor tidak ditemukan' 
            });
          }
          throw officeError;
        }
        office = data;
      } catch (err) {
        console.error('Office fetch Error:', err);
        return res.status(500).json({ 
          success: false,
          error: 'Gagal mengambil data kantor' 
        });
      }
    } else {
      // Default: ambil kantor pertama
      try {
        const { data, error: officeError } = await supabase
          .from('offices')
          .select('*')
          .limit(1);
        
        if (officeError || !data || data.length === 0) {
          return res.status(500).json({ 
            success: false,
            error: 'Konfigurasi kantor tidak ditemukan' 
          });
        }
        office = data[0];
      } catch (err) {
        console.error('Default office fetch Error:', err);
        return res.status(500).json({ 
          success: false,
          error: 'Gagal mengambil data kantor' 
        });
      }
    }

    // 4. Hitung Jarak User ke Kantor
    const distance = getDistanceFromLatLonInMeters(
      latitude,
      longitude,
      office.latitude,
      office.longitude
    );

    // 5. Validasi Radius (Default 50 meter jika tidak diset di DB)
    const MAX_RADIUS = office.radius_meters || 50;

    if (distance > MAX_RADIUS) {
      return res.status(400).json({
        success: false,
        message: `Anda berada di luar jangkauan kantor "${office.name}". Jarak: ${Math.round(distance)}m. Maksimal: ${MAX_RADIUS}m.`,
        distance: Math.round(distance),
        maxRadius: MAX_RADIUS
      });
    }

    // 6. Simpan Log Absensi jika valid
    const { data: insertedLog, error: logError } = await supabase
      .from('attendance_logs')
      .insert([
        {
          user_id: userId,
          check_in: new Date().toISOString(),
          lat: latitude,
          long: longitude,
          status: 'present',
        },
      ])
      .select('id')
      .single();

    if (logError) throw logError;

    return res.status(200).json({
      success: true,
      message: `Check-in berhasil! Selamat datang, ${user.full_name}.`,
      data: {
        office: office.name,
        distance: Math.round(distance),
        maxRadius: MAX_RADIUS,
        checkInTime: new Date().toISOString(),
        logId: insertedLog.id
      }
    });

  } catch (err) {
    console.error('Check-in Error:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Terjadi kesalahan internal server.' 
    });
  }
});

// Endpoint: Check-out Absensi
app.post('/api/check-out', async (req, res) => {
  const { userId, latitude, longitude } = req.body;

  // Validasi input
  if (!userId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ 
      success: false,
      error: 'Data tidak lengkap (userId, latitude, longitude dibutuhkan)' 
    });
  }

  // Validasi coordinate range
  if (!isValidCoordinates(latitude, longitude)) {
    return res.status(400).json({ 
      success: false,
      error: 'Koordinat tidak valid. Latitude: -90 to 90, Longitude: -180 to 180' 
    });
  }

  try {
    // 1. Validasi user ada di database
    const { exists: userExists, user } = await validateUserExists(userId);
    if (!userExists) {
      return res.status(400).json({ 
        success: false,
        error: 'User tidak ditemukan' 
      });
    }

    // 2. Cari attendance log yang belum check-out hari ini
    const { startOfDay, endOfDay } = getDayBoundaries();

    try {
      const { data: existingLog, error: findError } = await supabase
        .from('attendance_logs')
        .select('id, check_in')
        .eq('user_id', userId)
        .gte('check_in', startOfDay)
        .lt('check_in', endOfDay)
        .is('check_out', null)
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          return res.status(400).json({ 
            success: false,
            error: 'Tidak ada check-in aktif hari ini. Lakukan check-in terlebih dahulu.' 
          });
        }
        throw findError;
      }

      // 3. Update check-out time
      const checkOutTime = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('attendance_logs')
        .update({
          check_out: checkOutTime,
          lat: latitude,
          long: longitude
        })
        .eq('id', existingLog.id);

      if (updateError) throw updateError;

      // 4. Calculate duration
      const checkInDate = new Date(existingLog.check_in);
      const checkOutDate = new Date(checkOutTime);
      const durationMs = checkOutDate - checkInDate;
      const durationMinutes = Math.floor(durationMs / 60000);
      const durationHours = Math.floor(durationMinutes / 60);
      const durationMinsRemainder = durationMinutes % 60;

      return res.status(200).json({
        success: true,
        message: `Check-out berhasil! Terima kasih, ${user.full_name}.`,
        data: {
          checkInTime: existingLog.check_in,
          checkOutTime: checkOutTime,
          duration: `${durationHours}h ${durationMinsRemainder}m`,
          durationMinutes: durationMinutes
        }
      });
    } catch (err) {
      console.error('Check-out database Error:', err);
      throw err;
    }

  } catch (err) {
    console.error('Check-out Error:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Terjadi kesalahan internal server.' 
    });
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
