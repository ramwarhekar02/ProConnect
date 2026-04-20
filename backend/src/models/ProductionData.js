import mongoose from 'mongoose';

const productionDataSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      uppercase: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    totalPieces: {
      type: Number,
      required: true,
      min: 0,
    },
    defectivePieces: {
      type: Number,
      required: true,
      min: 0,
    },
    runtimeSeconds: {
      type: Number,
      required: true,
      min: 0,
    },
    downtimeSeconds: {
      type: Number,
      required: true,
      min: 0,
    },
    plannedProductionTimeSeconds: {
      type: Number,
      required: true,
      min: 0,
    },
    idealCycleTimeSeconds: {
      type: Number,
      default: 1,
      min: 0.1,
    },
  },
  { timestamps: true }
);

// Index for efficient querying
productionDataSchema.index({ machineId: 1, timestamp: -1 });
productionDataSchema.index({ timestamp: -1 });

const ProductionData = mongoose.model('ProductionData', productionDataSchema);

export default ProductionData;
