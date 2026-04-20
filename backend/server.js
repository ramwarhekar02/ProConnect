import http from 'http';
import 'dotenv/config';
import { Server as SocketIOServer } from 'socket.io';

import app from './src/app.js';
import connectDB from './src/config/database.js';
import { initializeSocket } from './src/sockets/socketHandler.js';
import Admin from './src/models/Admin.js';
import appSettingsService from './src/services/AppSettingsService.js';
import MQTTIngestionService from './src/services/MQTTIngestionService.js';

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000').split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize socket handlers
const socketHandlers = initializeSocket(io);
const mqttIngestionService = new MQTTIngestionService({ socketHandlers });

// Middleware to attach io and socket handlers to requests
app.use((req, res, next) => {
  req.io = io;
  req.socketHandlers = socketHandlers;
  next();
});

// Attach production data broadcast to controller via middleware
app.use((req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    // Broadcast production data if it was successfully recorded
    if (
      res.statusCode === 201 &&
      req.path.includes('/api/production/') &&
      req.method === 'POST' &&
      data.success
    ) {
      const oeeMetrics = data.oeeMetrics;
      const productionData = data.data;

      if (productionData && oeeMetrics) {
        socketHandlers.broadcastProductionData(productionData, oeeMetrics);
      }
    }

    return originalJson.call(this, data);
  };

  next();
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Initialize admin if doesn't exist
    const adminExists = await Admin.findOne({ username: 'admin' });
    if (!adminExists) {
      const admin = new Admin({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'Admin@123',
      });
      await admin.save();
      console.log('Default admin user created');
    }

    await appSettingsService.initialize(process.env.MQTT_AGGREGATION_WINDOW_SECONDS || 60);
    await mqttIngestionService.initialize();

    // Start server
    server.listen(PORT, () => {
      mqttIngestionService.start();
      console.log(`

✓ Server running on: http://localhost:${PORT}
✓ Environment: ${NODE_ENV}
✓ WebSocket enabled via Socket.IO
✓ Database: Connected
✓ Health check: GET /health
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await mqttIngestionService.stop();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await mqttIngestionService.stop();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

startServer();
