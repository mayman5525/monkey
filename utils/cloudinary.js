// utils/cloudinary.js
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// ------------------------------------------------------------------
// 1. Cloudinary config (reads from .env)
// ------------------------------------------------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ------------------------------------------------------------------
// 2. Upload from a Buffer (Multer memoryStorage gives you req.file.buffer)
// ------------------------------------------------------------------
const uploadFromBuffer = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'ecommerce',
        resource_type: 'image',
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

// ------------------------------------------------------------------
// 3. Delete a Cloudinary asset by public_id
// ------------------------------------------------------------------
const destroy = (publicId) => cloudinary.uploader.destroy(publicId);

// ------------------------------------------------------------------
// 4. Helper used by the old `processUploadedFile` (kept for backward compat)
// ------------------------------------------------------------------
const processUploadedFile = (file) => {
  // Old code returned {photo_data, photo_mime_type}
  // We keep the same shape only for the few places that still call it.
  return {
    photo_data: null,
    photo_mime_type: null,
  };
};

// ------------------------------------------------------------------
// 5. Helper to format item by removing photo data fields
// ------------------------------------------------------------------
const formatItemWithPhoto = (item) => {
  if (!item) return item;
  const { photo_data, photo_mime_type, photo_public_id, ...formattedItem } = item;
  return formattedItem;
};

module.exports = {
  cloudinary,
  uploadFromBuffer,
  destroy,
  processUploadedFile,   // keep for now – will be removed later
  formatItemWithPhoto,
};