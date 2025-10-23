// photoHelpers.js - Utility functions for handling photos

/**
 * Convert file buffer to base64 string
 * @param {Buffer} buffer - File buffer from multer or file upload
 * @returns {string} Base64 encoded string
 */
function bufferToBase64(buffer) {
  return buffer.toString("base64");
}

/**
 * Convert base64 string to data URI for frontend display
 * @param {string} base64 - Base64 encoded image
 * @param {string} mimeType - MIME type (e.g., 'image/jpeg')
 * @returns {string} Data URI string
 */
function base64ToDataURI(base64, mimeType) {
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Extract MIME type from file
 * @param {object} file - Multer file object
 * @returns {string} MIME type
 */
function getMimeType(file) {
  return file.mimetype;
}

/**
 * Validate image file
 * @param {object} file - Multer file object
 * @returns {boolean} True if valid image
 */
function isValidImage(file) {
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  return validTypes.includes(file.mimetype);
}

/**
 * Validate image size (max 5MB)
 * @param {object} file - Multer file object
 * @returns {boolean} True if size is acceptable
 */
function isValidSize(file, maxSizeMB = 5) {
  const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
  return file.size <= maxSize;
}

/**
 * Process uploaded file for database storage
 * @param {object} file - Multer file object
 * @returns {object} Object with photo_data and photo_mime_type
 */
function processUploadedFile(file) {
  if (!file) {
    return { photo_data: null, photo_mime_type: null };
  }

  if (!isValidImage(file)) {
    throw new Error(
      "Invalid image type. Only JPEG, PNG, GIF, and WebP are allowed."
    );
  }

  if (!isValidSize(file)) {
    throw new Error("File size too large. Maximum size is 5MB.");
  }

  return {
    photo_data: bufferToBase64(file.buffer),
    photo_mime_type: getMimeType(file),
  };
}

/**
 * Format product/merchant response with photo for frontend
 * @param {object} item - Database row
 * @returns {object} Formatted item with dataURI
 */
function formatItemWithPhoto(item) {
  if (item.photo_data && item.photo_mime_type) {
    return {
      ...item,
      photo_url: base64ToDataURI(item.photo_data, item.photo_mime_type),
    };
  }
  return item;
}

/**
 * Format multiple items with photos
 * @param {array} items - Array of database rows
 * @returns {array} Array of formatted items
 */
function formatItemsWithPhotos(items) {
  return items.map(formatItemWithPhoto);
}

module.exports = {
  bufferToBase64,
  base64ToDataURI,
  getMimeType,
  isValidImage,
  isValidSize,
  processUploadedFile,
  formatItemWithPhoto,
  formatItemsWithPhotos,
};
