import mongoose from 'mongoose';

const machineSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['running', 'idle', 'down', 'disconnected'],
      default: 'disconnected',
    },
    powerState: {
      type: String,
      enum: ['on', 'off'],
      default: 'on',
    },
    lastHeartbeat: {
      type: Date,
      default: null,
    },
    location: {
      type: String,
      required: true,
    },
    idealCycleTimeSeconds: {
      type: Number,
      min: 0.1,
      default: 1,
    },
    manualDefectivePieces: {
      type: Number,
      min: 0,
      default: 0,
    },
    machineImage: {
      dataUrl: {
        type: String,
        default: null,
      },
      mimeType: {
        type: String,
        default: null,
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    powerUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for efficient querying
machineSchema.index({ machineId: 1 });
machineSchema.index({ lastHeartbeat: 1 });

const Machine = mongoose.model('Machine', machineSchema);

export default Machine;
