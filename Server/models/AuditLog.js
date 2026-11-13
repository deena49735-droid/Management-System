const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      enum: {
        values: [
          'ENTRY_CREATE',
          'ENTRY_APPROVE',
          'ENTRY_REJECT',
          'ENTRY_REVERSAL',
          'ADMIN_AWARD',
          'ADMIN_ADJUSTMENT',
        ],
        message: '{VALUE} is not a valid audit action',
      },
    },
    targetType: {
      type: String,
      required: [true, 'Target type is required'],
      enum: {
        values: ['PointEntry', 'TeamPointEntry'],
        message: '{VALUE} is not a valid target type',
      },
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Target ID is required'],
      refPath: 'targetType',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Performing user is required'],
      ref: 'User',
    },
    previousStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      default: null,
    },
    points: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ targetId: 1, createdAt: -1 });
auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;

