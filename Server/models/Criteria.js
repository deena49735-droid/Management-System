const mongoose = require('mongoose');

const criteriaSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Criteria key is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: [true, 'Criteria name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['meeting_day', 'non_meeting_day', 'monthly', 'one_time', 'penalty'],
        message: '{VALUE} is not a valid criteria category',
      },
    },
    points: {
      type: Number,
      required: [true, 'Points value is required'],
    },
    basis: {
      type: String,
      required: [true, 'Basis is required'],
      enum: {
        values: [
          'per_member',
          'per_team',
          'per_visitor',
          'per_testimonial',
          'per_specific_ask',
          'per_week',
          'per_month',
        ],
        message: '{VALUE} is not a valid basis',
      },
      default: 'per_member',
    },
    basisLabel: {
      type: String,
      required: [true, 'Basis label is required'],
      trim: true,
      default: 'Per Member',
    },
    displayOrder: {
      type: Number,
      required: [true, 'Display order is required'],
      default: 1,
      index: true,
    },
    frequency: {
      type: String,
      required: [true, 'Frequency is required'],
      enum: {
        values: ['weekly', 'monthly', 'one_time'],
        message: '{VALUE} is not a valid frequency',
      },
      default: 'weekly',
    },
    level: {
      type: String,
      required: [true, 'Level is required'],
      enum: {
        values: ['member', 'team'],
        message: '{VALUE} is not a valid level',
      },
    },
    needsProof: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Criteria = mongoose.model('Criteria', criteriaSchema);

module.exports = Criteria;

