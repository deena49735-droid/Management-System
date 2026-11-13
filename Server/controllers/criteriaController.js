const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Criteria = require('../models/Criteria');
const {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  CATEGORY_LEVELS,
} = require('../constants/criteriaConstants');

/**
 * @desc    Get structured criteria grouped by official PDF categories
 * @route   GET /api/criteria/structure
 * @access  Private (Any authenticated user)
 */
exports.getCriteriaStructure = async (req, res, next) => {
  try {
    const allCriteria = await Criteria.find({}).sort({ displayOrder: 1, name: 1 });

    const categories = CATEGORY_ORDER.map((catKey) => {
      const itemsInCat = allCriteria.filter((c) => c.category === catKey);

      // Sort items by displayOrder
      itemsInCat.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

      const formattedItems = itemsInCat.map((c) => ({
        id: c._id,
        _id: c._id,
        key: c.key,
        name: c.name,
        points: c.points,
        basis: c.basis,
        basisLabel: c.basisLabel,
        displayOrder: c.displayOrder,
        frequency: c.frequency,
        level: c.level,
        needsProof: c.needsProof,
        isActive: c.isActive,
      }));

      // Calculate total points of ACTIVE items (penalties have no total)
      let total = null;
      if (catKey !== 'penalty') {
        total = formattedItems
          .filter((item) => item.isActive)
          .reduce((sum, item) => sum + item.points, 0);
      }

      const catData = {
        key: catKey,
        label: CATEGORY_LABELS[catKey],
        level: CATEGORY_LEVELS[catKey],
        total,
        items: formattedItems,
      };

      // For penalty category, also return items grouped by frequency: Weekly and Monthly
      if (catKey === 'penalty') {
        const weekly = formattedItems.filter((i) => i.frequency === 'weekly');
        const monthly = formattedItems.filter((i) => i.frequency === 'monthly');
        catData.weekly = weekly;
        catData.monthly = monthly;
        catData.groups = [
          { frequency: 'Weekly', label: 'Weekly Penalties', items: weekly },
          { frequency: 'Monthly', label: 'Monthly Penalties', items: monthly },
        ];
      }

      return catData;
    });

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all criteria (filterable by category, level, isActive)
 * @route   GET /api/criteria
 * @access  Private (Any authenticated user)
 */
exports.getCriteria = async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.level) {
      filter.level = req.query.level;
    }

    if (req.query.frequency) {
      filter.frequency = req.query.frequency;
    }

    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true' || req.query.isActive === true;
    }

    const criteria = await Criteria.find(filter).sort({ category: 1, displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      data: criteria,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new criteria item
 * @route   POST /api/criteria
 * @access  Private (Admin only)
 */
exports.createCriteria = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    const { key, name, category, points, basis, basisLabel, displayOrder, frequency, level, needsProof, isActive } =
      req.body;
    const normalizedKey = key.trim().toLowerCase();

    const existing = await Criteria.findOne({ key: normalizedKey });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A criteria with this key already exists.',
      });
    }

    const criteria = await Criteria.create({
      key: normalizedKey,
      name: name.trim(),
      category,
      points: Number(points),
      basis: basis || 'per_member',
      basisLabel: basisLabel ? basisLabel.trim() : 'Per Member',
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : 1,
      frequency: frequency || 'weekly',
      level,
      needsProof: Boolean(needsProof),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    res.status(201).json({
      success: true,
      data: criteria,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update criteria details (name, points, needsProof, isActive, basisLabel, displayOrder)
 * @route   PUT /api/criteria/:id
 * @access  Private (Admin only)
 */
exports.updateCriteria = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Criteria not found.',
      });
    }

    const criteria = await Criteria.findById(req.params.id);
    if (!criteria) {
      return res.status(404).json({
        success: false,
        message: 'Criteria not found.',
      });
    }

    if (req.body.name) criteria.name = req.body.name.trim();
    if (req.body.points !== undefined) criteria.points = Number(req.body.points);
    if (req.body.needsProof !== undefined) criteria.needsProof = Boolean(req.body.needsProof);
    if (req.body.isActive !== undefined) criteria.isActive = Boolean(req.body.isActive);
    if (req.body.category) criteria.category = req.body.category;
    if (req.body.basis) criteria.basis = req.body.basis;
    if (req.body.basisLabel) criteria.basisLabel = req.body.basisLabel.trim();
    if (req.body.displayOrder !== undefined) criteria.displayOrder = Number(req.body.displayOrder);
    if (req.body.frequency) criteria.frequency = req.body.frequency;

    await criteria.save();

    res.status(200).json({
      success: true,
      message: 'Criteria updated successfully.',
      data: criteria,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate criteria (soft delete)
 * @route   DELETE /api/criteria/:id
 * @access  Private (Admin only)
 */
exports.deactivateCriteria = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Criteria not found.',
      });
    }

    const criteria = await Criteria.findById(req.params.id);
    if (!criteria) {
      return res.status(404).json({
        success: false,
        message: 'Criteria not found.',
      });
    }

    criteria.isActive = false;
    await criteria.save();

    res.status(200).json({
      success: true,
      message: 'Criteria deactivated successfully.',
      data: criteria,
    });
  } catch (error) {
    next(error);
  }
};
