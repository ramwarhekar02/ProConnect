import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

// Routes
import authRoutes from './routes/authRoutes.js';
import machineRoutes from './routes/machineRoutes.js';
import productionRoutes from './routes/productionRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';

// Middleware
import errorHandler from './middleware/errorHandler.js';
import notFoundHandler from './middleware/notFoundHandler.js';

const app = express();

// ===== Security & Middleware =====

// Helmet for security headers
app.use(helmet());

// CORS Configuration
const corsOrigin = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000').split(
  ','
);
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body Parser
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));

// ===== Routes =====

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'OEE Monitoring System is running',
    timestamp: new Date(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/settings', settingsRoutes);

// ===== Error Handling =====

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
