const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const uploadController = require('../controllers/uploadController');

const router = express.Router();

// Memory storage for server-side processing & stream to Cloudinary
const storage = multer.memoryStorage();

// Allowed MIME types
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
    error.status = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max file size
  },
  fileFilter,
});

// Middleware to gracefully handle multer errors (file size, unexpected fields, invalid mime type)
const handleMulterUpload = (req, res, next) => {
  const uploadSingle = upload.single('image');
  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds 5 MB limit. Please select a smaller image.',
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error.',
        });
      }
      return res.status(err.status || 400).json({
        success: false,
        message: err.message || 'Invalid upload request.',
      });
    }
    next();
  });
};

// Rate limiter: 30 uploads per 15 minutes per user
const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Upload rate limit reached (30 uploads per 15 minutes). Please try again later.',
  },
});

// POST /api/uploads/proof
router.post(
  '/proof',
  auth,
  roleCheck('admin', 'teamHead', 'teamAssistant', 'member'),
  uploadRateLimiter,
  handleMulterUpload,
  uploadController.uploadProof
);

module.exports = router;

