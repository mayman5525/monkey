// utils/testUpload.js
const fs = require("fs");
const path = require("path");

// Load .env from PROJECT ROOT (not utils/)
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === CONFIG ===
const IMAGE_PATH = "./Screenshot_1.jpg"; // Image in project root

// === UPLOAD FROM BUFFER ===
async function testUpload() {
  try {
    const filePath = path.resolve(__dirname, IMAGE_PATH);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Image not found: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);

    console.log("Uploading to Cloudinary...");
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          folder: "ecommerce/test", // optional: organize
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(buffer);
    });

    console.log("UPLOAD SUCCESS!");
    console.log("URL:", result.secure_url);
    console.log("Public ID:", result.public_id);

    return result;
  } catch (error) {
    console.error("UPLOAD FAILED:", error.message);
    if (error.http_code) {
      console.error("Cloudinary Error:", error);
    }
  }
}

testUpload();
