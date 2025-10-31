const express = require("express");
const router = express.Router();
const pool = require("../modules/db");

// Serve product photo by product_id
router.get("/product/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT photo_data, photo_mime_type FROM product WHERE product_id = $1",
      [id]
    );

    if (result.rows.length === 0 || !result.rows[0].photo_data) {
      return res.status(404).send("Product photo not found");
    }

    res.setHeader("Content-Type", result.rows[0].photo_mime_type);
    res.send(result.rows[0].photo_data);
  } catch (err) {
    console.error("Error fetching product photo:", err);
    res.status(500).send("Error fetching product photo");
  }
});

// Serve merchant photo by merchant_id
router.get("/merchant/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT photo_data, photo_mime_type FROM merchant WHERE merchant_id = $1",
      [id]
    );

    if (result.rows.length === 0 || !result.rows[0].photo_data) {
      return res.status(404).send("Merchant photo not found");
    }

    res.setHeader("Content-Type", result.rows[0].photo_mime_type);
    res.send(result.rows[0].photo_data);
  } catch (err) {
    console.error("Error fetching merchant photo:", err);
    res.status(500).send("Error fetching merchant photo");
  }
});

module.exports = router;
