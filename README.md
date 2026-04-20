# OEE Monitoring System

A production-ready web-based **Overall Equipment Effectiveness (OEE)** monitoring system for knitting machines. The system receives real-time production data from Raspberry Pi devices and broadcasts live updates via WebSocket to a professional dashboard.

## Table of Contents

- [System Architecture](#system-architecture)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [WebSocket Events](#websocket-events)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)

---

## System Architecture

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│ Raspberry Pi    │       │   Express Backend    │       │ React Frontend  │
│ (IoT Device)    │──────>│   + WebSocket.io     │<─────>│   (Dashboard)   │
│                 │       │   + MongoDB          │       │                 │
└─────────────────┘       └──────────────────────┘       └─────────────────┘
  - Send heartbeat           - REST API                    - Real-time UI
  - Production data          - OEE calculation             - Charts & Analytics
  - Machine status           - Authentication              - Multi-user (Admin)
                            - Rate limiting
```

### OEE Calculation Formula

```
OEE = Availability × Performance × Quality

Where:
- Availability = Runtime / Planned Production Time
- Performance = (Ideal Cycle Time × Total Pieces) / Runtime
- Quality = (Total Pieces - Defective Pieces) / Total Pieces

OEE is expressed as a percentage (0-100%)
```

### Sensor Mapping (ESP32 -> OEE Inputs)

```json
{
  "IR": 0,
  "Vibration": 1,
  "Hall": 1,
  "machineId": "KM-001"
}
```

- `Hall` rising edge (`0 -> 1`) increments `totalPieces`
- `IR` rising edge (`0 -> 1`) increments `defectivePieces`
- `Vibration` high state accumulates `runtimeSeconds`
- `plannedProductionTimeSeconds` comes from `MQTT_AGGREGATION_WINDOW_SECONDS`

---

## Features

### Backend
- ✅ **REST API** for machine data management
- ✅ **JWT Authentication** with single admin login
- ✅ **WebSocket (Socket.io)** for real-time updates
- ✅ **MongoDB** for data persistence
- ✅ **OEE Calculation Service** with automatic metrics
- ✅ **Machine Disconnection Detection** (10-second timeout)
- ✅ **Rate Limiting** and **Helmet Security**
- ✅ **CORS** configuration for frontend integration
- ✅ **Modular Architecture** (Clean separation of concerns)
- ✅ **Error Handling** middleware
- ✅ **bcrypt** password hashing

### Frontend
- ✅ **Responsive Dashboard** with dark theme
- ✅ **Real-time Data Updates** via WebSocket
- ✅ **Multi-page Navigation** (Router)
- ✅ **Authentication** with JWT tokens
- ✅ **Charts & Analytics** (SVG-based, no external chart lib)
- ✅ **Machine Management** interface
- ✅ **OEE Analytics** with time range selection
- ✅ **CSV Export** for reports
- ✅ **Settings Management**
- ✅ **Tailwind CSS** styling
- ✅ **Device Disconnection Indicator**

---

## Installation

### Prerequisites

- **Node.js** v16+ (with npm)
- **MongoDB** (local or Atlas)
- **Git**

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file (already provided)
# Update MongoDB URI, JWT secret, admin credentials if needed
cat .env

# Start the server
npm run dev
```

Server will start on `http://localhost:5000`

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env file (already provided)
# Update API and Socket URLs if backend is on different host
cat .env

# Start development server
npm run dev
```

Frontend will start on `http://localhost:5173`

---

## Configuration

### Backend (.env file)

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/oee-monitoring

# JWT
JWT_SECRET=your_secret_key_here_min_32_chars
JWT_EXPIRE=24h

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Machine Configuration
MACHINE_HEARTBEAT_TIMEOUT=10000

# MQTT / HiveMQ Cloud
MQTT_ENABLED=true
MQTT_HOST=your_cluster.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=your_hivemq_username
MQTT_PASSWORD=your_hivemq_password
MQTT_TOPIC=esp32/sensors
MQTT_CLIENT_ID=oee-backend-client
MQTT_MACHINE_ID=KM-001
MQTT_TLS_REJECT_UNAUTHORIZED=false
MQTT_STORE_IDLE_WINDOWS=false
MQTT_AGGREGATION_WINDOW_SECONDS=60
MQTT_MAX_DELTA_SECONDS=10

# OEE Mapping
OEE_IDEAL_CYCLE_TIME_SECONDS=1
```

### Frontend (.env file)

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## Usage

### Login

1. Navigate to `http://localhost:5173/login`
2. Enter credentials:
   - **Username:** `admin`
   - **Password:** `Admin@123`
3. Click "Login"

### Dashboard

- View real-time OEE metrics
- Monitor machine status
- See availability, performance, and quality metrics
- Select different machines from dropdown

### Machines Page

- View all registered machines
- Add new machines with ID and location
- Delete machines
- See machine status and last heartbeat

### OEE Analytics

- Select machine and time range
- View detailed OEE trends
- See average metrics over time
- Analyze data points

### Reports

- Download production data as CSV
- View all production records
- Filter by machine

### Settings

- Configure API and Socket URLs
- Set refresh intervals
- View application information

---

## API Endpoints

### Authentication

```
POST   /api/auth/login              - Login with credentials
GET    /api/auth/verify (protected) - Verify JWT token
```

### Machines

```
GET    /api/machines (protected)                - Get all machines
POST   /api/machines (protected)                - Create new machine
GET    /api/machines/:machineId (protected)     - Get specific machine
PUT    /api/machines/:machineId (protected)     - Update machine
DELETE /api/machines/:machineId (protected)     - Delete machine
POST   /api/machines/:machineId/heartbeat       - Record heartbeat (public)
```

### Production Data

```
GET    /api/production (protected)                       - Get all production data
POST   /api/production/:machineId                        - Record production data (public)
GET    /api/production/:machineId (protected)            - Get machine production data
GET    /api/production/:machineId/latest (protected)     - Get latest production data
GET    /api/production/:machineId/metrics (protected)    - Get OEE metrics
```

### Health Check

```
GET    /health                      - Server health status
```

---

## WebSocket Events

### Client → Server

```javascript
// Join machine room for specific updates
socket.emit('join-machine', 'KM-001');

// Leave machine room
socket.emit('leave-machine', 'KM-001');
```

### Server → Client

```javascript
// Production update for specific machine
socket.on('production-update', (data) => {
  // data: { machineId, data, oeeMetrics, timestamp }
});

// Production update for all machines
socket.on('all-production-update', (data) => {
  // data: { machineId, data, oeeMetrics, timestamp }
});

// Machine status update for specific machine
socket.on('machine-status', (machine) => {
  // machine: { machineId, status, lastHeartbeat, ... }
});

// Machine status update for all machines
socket.on('all-machine-status', (machine) => {
  // machine: { machineId, status, lastHeartbeat, ... }
});
```

---

## Database Schema

### Admin Collection

```javascript
{
  _id: ObjectId,
  username: String (unique, lowercase),
  password: String (bcrypt hashed),
  createdAt: Date,
  updatedAt: Date
}
```

### Machine Collection

```javascript
{
  _id: ObjectId,
  machineId: String (unique, uppercase),
  status: 'running' | 'idle' | 'down' | 'disconnected',
  lastHeartbeat: Date,
  location: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### ProductionData Collection

```javascript
{
  _id: ObjectId,
  machineId: String (uppercase),
  timestamp: Date,
  totalPieces: Number,
  defectivePieces: Number,
  runtimeSeconds: Number,
  downtimeSeconds: Number,
  plannedProductionTimeSeconds: Number,
  idealCycleTimeSeconds: Number,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Project Structure

### Backend

```
backend/
├── src/
│   ├── config/
│   │   └── database.js              # MongoDB connection
│   ├── models/
│   │   ├── Admin.js                 # Admin schema with bcrypt
│   │   ├── Machine.js               # Machine schema
│   │   └── ProductionData.js        # Production data schema
│   ├── controllers/
│   │   ├── authController.js        # Login & verify logic
│   │   ├── machineController.js     # Machine CRUD & heartbeat
│   │   └── productionController.js  # Production data & OEE
│   ├── routes/
│   │   ├── authRoutes.js            # Auth endpoints
│   │   ├── machineRoutes.js         # Machine endpoints
│   │   └── productionRoutes.js      # Production endpoints
│   ├── services/
│   │   └── OEECalculationService.js # OEE math calculations
│   ├── middleware/
│   │   ├── authMiddleware.js        # JWT verification
│   │   ├── errorHandler.js          # Error handling
│   │   └── notFoundHandler.js       # 404 handler
│   ├── sockets/
│   │   └── socketHandler.js         # WebSocket setup
│   └── app.js                       # Express app setup
├── server.js                         # Server entry point
├── package.json
├── .env
└── .gitignore
```

### Frontend

```
frontend/
├── src/
│   ├── layout/
│   │   └── MainLayout.jsx           # Sidebar + main content
│   ├── components/
│   │   ├── cards/
│   │   │   └── CardComponents.jsx   # Metric & OEE cards
│   │   ├── charts/
│   │   │   └── ChartComponents.jsx  # SVG charts
│   │   └── status/
│   │       └── StatusComponents.jsx # Status badges
│   ├── pages/
│   │   ├── Login/
│   │   │   └── LoginPage.jsx
│   │   ├── Dashboard/
│   │   │   └── DashboardPage.jsx
│   │   ├── Machines/
│   │   │   └── MachinesPage.jsx
│   │   ├── OEE/
│   │   │   └── OEEPage.jsx
│   │   ├── Reports/
│   │   │   └── ReportsPage.jsx
│   │   └── Settings/
│   │       └── SettingsPage.jsx
│   ├── services/
│   │   ├── apiService.js            # API client
│   │   └── socketService.js         # WebSocket client
│   ├── hooks/
│   │   ├── useAuth.js               # Auth logic
│   │   └── useSocket.js             # WebSocket logic
│   ├── utils/
│   │   └── helpers.js               # Utility functions
│   ├── App.jsx                      # Main router
│   ├── App.css
│   ├── index.css                    # Tailwind imports
│   └── main.jsx
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
├── package.json
├── .env
└── .gitignore
```

---

## Raspberry Pi Integration Example

### Send Production Data

```javascript
// Node.js example running on Raspberry Pi
const axios = require('axios');

const machineId = 'KM-001';
const apiUrl = 'http://backend-server:5000/api';

// Send heartbeat
setInterval(() => {
  axios.post(`${apiUrl}/machines/${machineId}/heartbeat`, {
    status: 'running'
  }).catch(err => console.error('Heartbeat failed:', err));
}, 5000); // Every 5 seconds

// Send production data periodically
async function sendProductionData() {
  try {
    const response = await axios.post(
      `${apiUrl}/production/${machineId}`,
      {
        totalPieces: 150,
        defectivePieces: 3,
        runtimeSeconds: 900,
        downtimeSeconds: 60,
        plannedProductionTimeSeconds: 960,
        idealCycleTimeSeconds: 6,
        timestamp: new Date()
      }
    );
    console.log('Data sent:', response.data);
  } catch (err) {
    console.error('Failed to send data:', err);
  }
}

// Send data every minute
setInterval(sendProductionData, 60000);
```

### CURL Examples

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'

# Record heartbeat
curl -X POST http://localhost:5000/api/machines/KM-001/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"status":"running"}'

# Send production data
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
```

---

## Production Deployment

### Backend Deployment

1. **Environment Setup**
   ```bash
   NODE_ENV=production
   JWT_SECRET=<long-random-string>
   MONGODB_URI=<production-mongodb>
   ```

2. **Use PM2 for process management**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "oee-backend"
   ```

3. **Nginx reverse proxy** recommended

4. **Use HTTPS** in production

### Frontend Deployment

1. **Build for production**
   ```bash
   npm run build
   ```

2. **Deploy dist folder** to static hosting
   - Vercel, Netlify, AWS S3, etc.

3. **Update environment variables** for production API/Socket URLs

---

## Monitoring & Maintenance

### Key Metrics to Monitor

- Machine disconnection rate
- OEE trend over time
- Production data latency
- API response times
- Database size

### Backup Strategy

- Daily MongoDB backups
- Weekly full backup archives
- Off-site backup storage

---

## Troubleshooting

### Backend Issues

| Issue | Solution |
|-------|----------|
| Port 5000 in use | Change `PORT` in .env |
| MongoDB connection failed | Check MongoDB URI in .env |
| Token not working | Verify `JWT_SECRET` is set |
| CORS errors | Update `CORS_ORIGIN` in .env |

### Frontend Issues

| Issue | Solution |
|-------|----------|
| API not found | Check `VITE_API_BASE_URL` in .env |
| WebSocket disconnected | Verify `VITE_SOCKET_URL` is correct |
| Login fails | Check backend is running |
| Charts not rendering | Check browser console for errors |

---

## License

MIT License

---

## Support

For issues or questions, please create an issue in the repository.

---

**Version:** 1.0.0  
**Last Updated:** February 2026
