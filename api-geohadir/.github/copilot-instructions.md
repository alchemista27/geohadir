# GeoHadir API - Copilot Instructions

## Project Overview
**GeoHadir** is a geolocation-based attendance system API built with Express.js and Supabase. It validates employee check-ins against office location boundaries using GPS coordinates and the Haversine formula for distance calculation.

**Architecture**: Single Express server deployed on Vercel. Coordinates with Supabase for attendance logs and office configuration storage.

## Core Functionality
- **Check-in Endpoint** (`POST /api/check-in`): Validates user exists in `profiles`, GPS location against office radius, prevents duplicate same-day check-ins
- **Check-out Endpoint** (`POST /api/check-out`): Records check-out time for active attendance logs
- **Distance Calculation**: Uses Haversine formula to compute meters between user and office coordinates
- **Radius Validation**: Defaults to 50m radius; configurable per office in `offices` table
- **Multi-office Support**: Can specify `officeId` in request; defaults to first office if not provided
- **Attendance Logging**: Persists check-in/check-out times to `attendance_logs` table with timestamp and coordinates

## Key Technical Patterns

### Location Validation Workflow
```javascript
// Check-in flow:
1. Validate userId exists in profiles table (check role, get full_name)
2. Check for active check-in same day (prevent duplicates)
3. Fetch office config from Supabase: use officeId param or default to first office
4. Calculate distance using getDistanceFromLatLonInMeters()
5. Compare against MAX_RADIUS (office.radius_meters || 50)
6. Insert to attendance_logs if valid; include office name in response

// Check-out flow:
1. Validate userId exists in profiles table
2. Find active attendance_log (check_in today, check_out is null)
3. Update record with check_out timestamp and location
4. Return duration info (check_in to check_out)
```

### Environment Configuration
- **Required variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (defined in `.env`)
- Use `require('dotenv').config()` at startup
- PORT defaults to 3000; overridable via `process.env.PORT`

### Error Handling Pattern
- Return 400 for client input errors (missing fields, out-of-radius)
- Return 500 for server/DB errors
- Always include `success` boolean and `message` in responses for consistency

## Database Schema (Supabase)
- **offices**: `id`, `latitude`, `longitude`, `radius_meters`
- **attendance_logs**: `id`, `user_id`, `check_in` (timestamp), `lat`, `long`, `status`

## Development & Deployment
- **Local**: `npm install && PORT=3000 npm start` (no formal start script yet)
- **Deployment**: Vercel serverless via [vercel.json](vercel.json)
- **Testing**: No automated tests configured; manual endpoint testing required
- **Dependencies**: Express 5.2.1, Supabase 2.93.2, CORS enabled

## Adding New Endpoints
1. Define route handler with proper validation (check required fields)
2. Interact with Supabase using `.from('table').select/insert/update()`
3. Include CORS handling via middleware (already configured)
4. Follow response format: `{success: boolean, message: string, data?: any}`
5. Update this guide if endpoint introduces new database tables or patterns

## Common Patterns to Reuse
- **Input validation**: Always check `!userId || latitude === undefined || longitude === undefined` before DB queries (use `=== undefined` for coordinates)
- **User validation**: Call `validateUserExists(userId)` first to ensure user exists and get profile data
- **Duplicate prevention**: Use `isDuplicateCheckInToday(userId)` to prevent same-day duplicates with active check-in
- **Multi-office queries**: Use `.eq('id', officeId)` when officeId provided, else `.limit(1)` for default
- **Supabase queries**: Use `.single()` for guaranteed single results, `.select('id')` to minimize data transfer
- **Timestamp handling**: Use `.toISOString()` for all timestamps, filter by date range with `.gte()` and `.lt()`
- **Error logging**: Always `console.error('Context:', err)` with operation context for debugging
