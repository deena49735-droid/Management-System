const mongoose = require('mongoose');

const meetingRowSchema = new mongoose.Schema(
  {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member is required'],
    },
    arrivalTime: {
      type: String,
      default: null,
      trim: true,
    },
    attendance: {
      type: String,
      enum: {
        values: ['present', 'late', 'absent'],
        message: '{VALUE} is not a valid attendance status',
      },
      default: 'present',
    },
    walkedOut: {
      type: Boolean,
      default: false,
    },
    attire: {
      type: String,
      enum: {
        values: ['full', 'missing_pin_badge', 'none'],
        message: '{VALUE} is not a valid attire option',
      },
      default: 'none',
    },
    activities: [
      {
        criteria: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Criteria',
          required: [true, 'Criteria is required'],
        },
        quantity: {
          type: Number,
          default: 1,
          min: [1, 'Quantity must be at least 1'],
        },
      },
    ],
  },
  { _id: true }
);

const meetingSchema = new mongoose.Schema(
  {
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team is required'],
    },
    date: {
      type: Date,
      required: [true, 'Meeting date is required'],
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
    status: {
      type: String,
      enum: {
        values: ['draft', 'submitted', 'approved'],
        message: '{VALUE} is not a valid meeting status',
      },
      default: 'draft',
    },
    rows: [meetingRowSchema],
    sendBackReason: {
      type: String,
      trim: true,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required'],
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
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
  },
  {
    timestamps: true,
  }
);

// Indexes
meetingSchema.index({ team: 1, date: 1 }, { unique: true });
meetingSchema.index({ team: 1, status: 1 });
meetingSchema.index({ status: 1, year: 1, month: 1, weekNumber: 1 });

const Meeting = mongoose.model('Meeting', meetingSchema);

module.exports = Meeting;

