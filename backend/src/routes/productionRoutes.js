import express from 'express';
import {
  getProductionData,
  getProductionDataByMachine,
  recordProductionData,
  getLatestProductionData,
  getOEEMetrics,
  getOverallOEEMetrics,
} from '../controllers/productionController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Protected routes (require authentication)
router.get('/', authMiddleware, getProductionData);
router.get('/overall/metrics', authMiddleware, getOverallOEEMetrics);
router.get('/:machineId/latest', authMiddleware, getLatestProductionData);
router.get('/:machineId/metrics', authMiddleware, getOEEMetrics);
router.get('/:machineId', authMiddleware, getProductionDataByMachine);

// Public endpoint for Raspberry Pi devices to submit data
router.post('/:machineId', recordProductionData);

export default router;
