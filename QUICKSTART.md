# Quick Start Guide - OEE Monitoring System

## Prerequisites

Ensure you have installed:
- **Node.js v16+** (with npm)
- **MongoDB** (running locally or connection string ready)

## 🚀 Quick Start (5 minutes)

### Step 1: Start MongoDB

```bash
# If running locally
mongod

# Or update MONGODB_URI in backend/.env with your MongoDB Atlas connection string
```

### Step 2: Start the Backend

```bash
cd backend

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

✅ Backend running on: `http://localhost:5000`

### Step 3: Start the Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

✅ Frontend running on: `http://localhost:5173`

### Step 4: Login to Dashboard

1. Open `http://localhost:5173/login` in your browser
2. Enter credentials:
   - **Username:** `admin`
   - **Password:** `Admin@123`
3. Click "Login" → You'll be redirected to the Dashboard

---

## 📝 First Test - Send Data

### Test with curl

Open a new terminal and send test production data:

```bash
# 1. Record a machine heartbeat
curl -X POST http://localhost:5000/api/machines/KM-001/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"status":"running"}'

# 2. Send production data
curl -X POST http://localhost:5000/api/production/KM-001 \
  -H "Content-Type: application/json" \
  -d '{
    "totalPieces":150,
    "defectivePieces":3,
    "runtimeSeconds":900,
    "downtimeSeconds":60,
    "plannedProductionTimeSeconds":960,
    "idealCycleTimeSeconds":6
  }'

# 3. Verify data was recorded
curl -X GET "http://localhost:5000/api/machines" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test with JavaScript (Node.js)

Create a test file `test-data.js`:

```javascript
const axios = require('axios');

const API = 'http://localhost:5000/api';
const MACHINE_ID = 'KM-001';

async function sendTestData() {
  try {
    // Send heartbeat
    console.log('📡 Sending heartbeat...');
    await axios.post(`${API}/machines/${MACHINE_ID}/heartbeat`, {
      status: 'running'
    });

    // Send production data
    console.log('📊 Sending production data...');
    const result = await axios.post(
      `${API}/production/${MACHINE_ID}`,
      {
        totalPieces: 150,
        defectivePieces: 3,
        runtimeSeconds: 900,
        downtimeSeconds: 60,
        plannedProductionTimeSeconds: 960,
        idealCycleTimeSeconds: 6
      }
    );

    console.log('✅ Success!');
    console.log('OEE Metrics:', result.data.oeeMetrics);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

sendTestData();
```

Run it:
```bash
npm install axios
node test-data.js
```

---

## 🎮 Dashboard Features

### Dashboard Page
- View real-time OEE metrics
- See machine status
- Watch live updates (WebSocket)

### Machines Page
- View all machines
- Add new machines
- Delete machines
- Monitor heartbeat status

### OEE Analytics
- Select time range (1hr, 8hr, 24hr, 7 days, 30 days)
- View trend charts
- See average metrics

### Reports
- Download production data as CSV
- Filter by machine
- View all historical data

### Settings
- Configure API URL
- Configure WebSocket URL
- Reset to defaults

---

## 🔐 Admin Credentials

**Default Login:**
- Username: `admin`
- Password: `Admin@123`

⚠️ Change these in `backend/.env` for production!

---

## 🗄️ Database Check

### View Collections

```bash
# Open MongoDB CLI
mongo

# Use the database
use oee-monitoring

# Check collections
show collections

# View data
db.admins.find()
db.machines.find()
db.productiondatas.find()
```

---

## 🐛 Troubleshooting

### Port 5000 Already in Use

```bash
# Find process using port 5000 (Windows)
netstat -ano | findstr :5000

# Kill process (Windows)
taskkill /PID <PID> /F

# Or change PORT in backend/.env
PORT=5001
```

### MongoDB Connection Error

```bash
# Check MongoDB is running
mongod --version

# Update connection string in backend/.env
MONGODB_URI=mongodb://localhost:27017/oee-monitoring
```

### WebSocket Connection Error

- Verify backend is running
- Check `VITE_SOCKET_URL` in frontend/.env
- Clear browser cache and reload

### CORS Errors

Update `CORS_ORIGIN` in backend/.env to match your frontend URL:

```env
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

---

## 📚 Architecture Overview

```
Raspberry Pi IoT Devices
        ↓
   REST API
        ↓
  Backend (Express)
   - Validate data
   - Calculate OEE
   - Store in MongoDB
        ↓
   WebSocket (Socket.io)
        ↓
  Frontend (React)
   - Real-time dashboard
   - Live charts
   - Analytics
```

---

## 🚀 Next Steps

1. **Integrate with Raspberry Pi:**
   - Install Python/Node.js on Pi
   - Send heartbeat every 5-10 seconds
   - Send production data every minute

2. **Production Deployment:**
   - Deploy backend to cloud (AWS, Heroku, DigitalOcean)
   - Deploy frontend to Vercel, Netlify, or AWS S3
   - Set up HTTPS and proper secrets

3. **Advanced Features:**
   - Add multiple admin users
   - Implement role-based access
   - Add data retention policies
   - Create email alerts for low OEE

---

## 📖 Documentation

- See `README.md` for detailed documentation
- API endpoints in `backend/src/routes/`
- Component structure in `frontend/src/`

---

## 🎯 Key Endpoints

| Method | URL | Protected | Purpose |
|--------|-----|-----------|---------|
| POST | `/api/auth/login` | ❌ | Admin login |
| POST | `/api/machines/:id/heartbeat` | ❌ | Send heartbeat from Pi |
| POST | `/api/production/:id` | ❌ | Send production data from Pi |
| GET | `/api/machines` | ✅ | List all machines |
| GET | `/api/production/:id/metrics` | ✅ | Get OEE metrics |

✅ = Requires JWT token in header: `Authorization: Bearer <token>`

---

## 💡 Tips

- **Data Updates Live?** Check browser console for WebSocket connection
- **Charts Not Loading?** Refresh page and ensure machine has recent data
- **OEE Calculation Off?** Verify your data values are realistic
- **Machine Disconnected?** It means no data in 10 seconds - send heartbeat/data

---

**Happy monitoring! 🎉**
