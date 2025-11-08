const express = require('express');
const router = express.Router();
const Vault = require('../models/Vault');
const auth = require('../middleware/auth');

// Create vault
router.post('/create', auth, async (req, res) => {
  try {
    const { name, type } = req.body;
    const vault = new Vault({
      name,
      type,
      user: req.user.id
    });
    await vault.save();
    res.json(vault);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List vaults
router.get('/list', auth, async (req, res) => {
  try {
    const vaults = await Vault.find({ user: req.user.id });
    res.json(vaults);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get vault by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const vault = await Vault.findOne({ _id: req.params.id, user: req.user.id });
    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }
    res.json(vault);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete vault
router.delete('/:id', auth, async (req, res) => {
  try {
    const vault = await Vault.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }
    res.json({ message: 'Vault deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
