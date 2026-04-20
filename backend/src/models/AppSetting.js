import mongoose from 'mongoose';

const appSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global',
    },
    plannedProductionTimeSeconds: {
      type: Number,
      required: true,
      min: 1,
      default: 60,
    },
    apiUrl: {
      type: String,
      required: true,
      default: 'http://localhost:5000/api',
      trim: true,
    },
    socketUrl: {
      type: String,
      required: true,
      default: 'http://localhost:5000',
      trim: true,
    },
    refreshInterval: {
      type: Number,
      required: true,
      min: 1000,
      max: 60000,
      default: 5000,
    },
    comparisonLookbackHours: {
      type: Number,
      required: true,
      min: 1,
      max: 168,
      default: 1,
    },
    defaultIdealCycleTimeSeconds: {
      type: Number,
      required: true,
      min: 0.1,
      default: 1,
    },
    defaultBadPieces: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    idealMachine: {
      machineId: {
        type: String,
        default: 'IDEAL_MACHINE',
        trim: true,
      },
      oee: {
        type: Number,
        min: 0,
        max: 100,
        default: 100,
      },
      availability: {
        type: Number,
        min: 0,
        max: 100,
        default: 100,
      },
      performance: {
        type: Number,
        min: 0,
        max: 100,
        default: 100,
      },
      quality: {
        type: Number,
        min: 0,
        max: 100,
        default: 100,
      },
      totalPieces: {
        type: Number,
        min: 0,
        default: 1200,
      },
      goodPieces: {
        type: Number,
        min: 0,
        default: 1200,
      },
      defectivePieces: {
        type: Number,
        min: 0,
        default: 0,
      },
      runtimeMinutes: {
        type: Number,
        min: 0,
        default: 60,
      },
      idealCycleTimeHours: {
        type: Number,
        min: 0,
        default: 1,
      },
    },
  },
  { timestamps: true }
);

const AppSetting = mongoose.model('AppSetting', appSettingSchema);

export default AppSetting;
