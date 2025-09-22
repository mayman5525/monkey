const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'products',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }],
  },
});

// Initialize Multer with Cloudinary storage
const upload = multer({ storage: storage });

// Function to upload photo to Cloudinary
const uploadProductPhoto = async (file) => {
  try {
    // The file is handled by multer-cloudinary, so we return the URL
    return file.path; // CloudinaryStorage provides the URL in file.path
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

module.exports = {
  upload,
  uploadProductPhoto,
};