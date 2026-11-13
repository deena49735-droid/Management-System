const mongoose = require('mongoose');

const pointEntrySchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member is required'],
    },
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
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    points: {
      type: Number,
      required: [true, 'Calculated points are required'],
    },
    date: {
      type: Date,
      required: [true, 'Date of activity is required'],
    },
    weekNumber: {
      type: Number,
      required: [true, 'Week number is required'],
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
        values: ['weekly', 'monthly'],
        message: '{VALUE} is not a valid point entry frequency',
      },
      default: 'weekly',
    },
    proofImage: {
      type: String,
      default: null,
    },
    proofPublicId: {
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
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Entered by user reference is required'],
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
      ref: 'PointEntry',
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
pointEntrySchema.pre('validate', function () {
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

// Indexes for fast querying & filtering
pointEntrySchema.index({ member: 1, date: 1 });
pointEntrySchema.index({ team: 1, status: 1 });
pointEntrySchema.index({ weekNumber: 1, month: 1, year: 1 });
pointEntrySchema.index({ status: 1, team: 1, year: 1, month: 1, weekNumber: 1 });

// Deduplication Indexes (Partial Unique)
pointEntrySchema.index(
  { member: 1, criteria: 1, weekNumber: 1, year: 1 },
  {
    name: 'uniq_point_weekly_active',
    unique: true,
    partialFilterExpression: {
      frequency: 'weekly',
      isReversal: false,
      isAdminAdjustment: false,
      status: { $in: ['pending', 'approved'] },
    },
  }
);

pointEntrySchema.index(
  { member: 1, criteria: 1, month: 1, year: 1 },
  {
    name: 'uniq_point_monthly_active',
    unique: true,
    partialFilterExpression: {
      frequency: 'monthly',
      isReversal: false,
      isAdminAdjustment: false,
      status: { $in: ['pending', 'approved'] },
    },
  }
);

pointEntrySchema.index(
  { reversalOf: 1 },
  {
    name: 'uniq_point_reversal',
    unique: true,
    partialFilterExpression: {
      isReversal: true,
    },
  }
);

const PointEntry = mongoose.model('PointEntry', pointEntrySchema);

module.exports = PointEntry;
