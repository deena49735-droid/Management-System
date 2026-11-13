const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload an in-memory buffer to Cloudinary
 * Target folder: kadambas/proofs
 * Resource type: image
 */
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return reject(new Error('Cloudinary credentials are not configured on the server.'));
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'kadambas/proofs',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

/**
 * @desc    Upload proof photo to Cloudinary
 * @route   POST /api/uploads/proof
 * @access  Private (all four roles)
 */
exports.uploadProof = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded. Please attach an image under the "image" field.',
      });
    }

    const result = await uploadToCloudinary(req.file.buffer);

    return res.status(200).json({
      success: true,
      data: {
        url: result.secure_url || result.url,
        publicId: result.public_id,
      },
    });
  } catch (error) {
    console.error('[Upload Error]:', error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Image upload failed. Please try again.',
    });
  }
};

