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
      required: [true, 'Criteria is required'],
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
  },
  {
    timestamps: true,
  }
);

// Indexes for fast querying & filtering
pointEntrySchema.index({ member: 1, date: 1 });
pointEntrySchema.index({ team: 1, status: 1 });
pointEntrySchema.index({ weekNumber: 1, month: 1, year: 1 });

const PointEntry = mongoose.model('PointEntry', pointEntrySchema);

module.exports = PointEntry;

