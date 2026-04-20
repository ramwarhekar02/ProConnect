import mongoose from 'mongoose';

const aggregationStateSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    windowStartMs: {
      type: Number,
      required: true,
      min: 0,
    },
    lastTimestampMs: {
      type: Number,
      required: true,
      min: 0,
    },
    lastHall: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    lastIr: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    lastVibration: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    lastPieceCountedAtMs: {
      type: Number,
      default: null,
      min: 0,
    },
    lastDefectCountedAtMs: {
      type: Number,
      default: null,
      min: 0,
    },
    totalPieces: {
      type: Number,
      default: 0,
      min: 0,
    },
    defectivePieces: {
      type: Number,
      default: 0,
      min: 0,
    },
    runtimeSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const AggregationState = mongoose.model('AggregationState', aggregationStateSchema);

export default AggregationState;
