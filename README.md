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

## License

MIT License

---

## Support

For issues or questions, please create an issue in the repository.

---

**Version:** 1.0.0  
**Last Updated:** February 2026
