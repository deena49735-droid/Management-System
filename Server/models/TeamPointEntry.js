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
      required: [true, 'Criteria is required'],
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
  },
  {
    timestamps: true,
  }
);

// Compound indexes
teamPointEntrySchema.index({ team: 1, criteria: 1, month: 1, year: 1 });
teamPointEntrySchema.index({ team: 1, status: 1 });

const TeamPointEntry = mongoose.model('TeamPointEntry', teamPointEntrySchema);

module.exports = TeamPointEntry;

