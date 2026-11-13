const mongoose = require('mongoose');

const teamPointEntrySchema = new mongoose.Schema(
  {
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team is required'],
    },
    criteria: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Criteria',
      required: function () {
        return !this.isAdminAdjustment && !this.isReversal;
      },
      default: null,
    },
    points: {
      type: Number,
      required: [true, 'Points are required'],
    },
    month: {
      type: Number,
      required: [true, 'Month is required'],
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
    },
    frequency: {
      type: String,
      required: [true, 'Frequency is required'],
      enum: {
        values: ['monthly', 'one_time'],
        message: '{VALUE} is not a valid team point frequency',
      },
    },
    proofImage: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: '{VALUE} is not a valid status',
      },
      default: 'pending',
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Submitted by user is required'],
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    isAdminAdjustment: {
      type: Boolean,
      default: false,
      index: true,
    },
    isReversal: {
      type: Boolean,
      default: false,
      index: true,
    },
    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamPointEntry',
      default: null,
    },
    reversalReason: {
      type: String,
      trim: true,
      default: null,
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reversedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook for reversal integrity
teamPointEntrySchema.pre('validate', function () {
  if (this.isReversal) {
    if (!this.reversalOf) {
      this.invalidate('reversalOf', 'reversalOf is required when isReversal is true.');
    }
    if (!this.reversalReason || !this.reversalReason.trim()) {
      this.invalidate('reversalReason', 'reversalReason is required when isReversal is true.');
    }
  } else if (this.reversalOf) {
    this.invalidate('reversalOf', 'reversalOf must be null for non-reversal entries.');
  }
});

// Compound query indexes
teamPointEntrySchema.index({ team: 1, criteria: 1, month: 1, year: 1 });
teamPointEntrySchema.index({ team: 1, status: 1 });
teamPointEntrySchema.index({ status: 1, team: 1, year: 1, month: 1 });

// Deduplication Indexes (Partial Unique)
teamPointEntrySchema.index(
  { team: 1, criteria: 1, month: 1, year: 1 },
  {
    name: 'uniq_teampoint_monthly_active',
    unique: true,
    partialFilterExpression: {
      frequency: 'monthly',
      isReversal: false,
      isAdminAdjustment: false,
      status: { $in: ['pending', 'approved'] },
    },
  }
);

teamPointEntrySchema.index(
  { team: 1, criteria: 1 },
  {
    name: 'uniq_teampoint_one_time_active',
    unique: true,
    partialFilterExpression: {
      frequency: 'one_time',
      isReversal: false,
      isAdminAdjustment: false,
      status: { $in: ['pending', 'approved'] },
    },
  }
);

teamPointEntrySchema.index(
  { reversalOf: 1 },
  {
    name: 'uniq_teampoint_reversal',
    unique: true,
    partialFilterExpression: {
      isReversal: true,
    },
  }
);

const TeamPointEntry = mongoose.model('TeamPointEntry', teamPointEntrySchema);

module.exports = TeamPointEntry;
