const ExtraClass = require("../controller/extras");
const pool = require("../modules/db");
const express = require("express");
const router = express.Router();
const extraController = new ExtraClass();
// Get all extras
router.get("/", async (req, res) => {
  try {
    const client = await pool.connect();
    const extras = await extraController.getAllExtras(client);
    client.release();
    res.status(200).json(extras);
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while retrieving extras" });
  }
});
// Create a new extra (admin only)
router.post("/", async (req, res) => {
  try {
    const { extraName, extraPrice } = req.body;
    if (!extraName || !extraPrice) {
      return res
        .status(400)
        .json({ error: "extraName and extraPrice are required" });
    }
    const client = await pool.connect();
    const newExtra = await extraController.createExtra(
      extraName,
      extraPrice,
      client
    );
    client.release();
    res.status(201).json(newExtra);
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while creating the extra" });
  }
});
// Delete an extra (admin only)
router.delete("/:extraId", async (req, res) => {
  try {
    const extraId = parseInt(req.params.extraId, 10);
    if (isNaN(extraId)) {
      return res.status(400).json({ error: "Invalid extraId" });
    }
    const client = await pool.connect();
    const deletedExtra = await extraController.deleteExtra(extraId, client);
    client.release();
    if (!deletedExtra) {
      return res.status(404).json({ error: "Extra not found" });
    }
    res
      .status(200)
      .json({ message: "Extra deleted successfully", extra: deletedExtra });
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while deleting the extra" });
  }
});
router.get("/:extraId", async (req, res) => {
  try {
    const extraId = parseInt(req.params.extraId, 10);
    if (isNaN(extraId)) {
      return res.status(400).json({ error: "Invalid extraId" });
    }
    const client = await pool.connect();
    const extra = await extraController.getExtraById(extraId, client);
    client.release();
    if (!extra) {
      return res.status(404).json({ error: "Extra not found" });
    }
    res.status(200).json(extra);
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while retrieving the extra" });
  }
  router.put("/:extraId", async (req, res) => {
    const client = await pool.connect();
    const extraId = parseInt(req.params.extraId, 10);
    const { extraName, extraPrice } = req.body;
    if (isNaN(extraId) || !extraName || !extraPrice) {
      client.release();
      return res
        .status(400)
        .json({ error: "Invalid extraId, extraName, or extraPrice" });
    }
    const updatedExtra = await extraController.updateExtra(
      extraId,
      extraName,
      extraPrice,
      client
    );
    client.release();
    if (!updatedExtra) {
      return res.status(404).json({ error: "Extra not found" });
    }
    res.status(200).json(updatedExtra);
  });
});

module.exports = router;
