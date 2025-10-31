// test-cloudinary.js
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Configure with .env vars
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test ping
cloudinary.api.ping()
  .then((result) => {
    console.log('Ping successful! Connection to Cloudinary is working:', result);
  })
  .catch((error) => {
    console.error('Ping failed! Check your credentials or network:', error);
  });