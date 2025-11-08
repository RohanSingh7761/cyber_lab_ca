const express = require('express');
const router = express.Router();
const Credential = require('../models/Credential');
const Vault = require('../models/Vault');
const auth = require('../middleware/auth');

// Add credential
router.post('/add', auth, async (req, res) => {
  try {
    const { vaultId, title, username, password, url, notes } = req.body;
    
    const vault = await Vault.findOne({ _id: vaultId, user: req.user.id });
    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }

    const credential = new Credential({
      vault: vaultId,
      title,
      username,
      password,
      url,
      notes
    });
    
    await credential.save();
    res.json(credential);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List credentials by vault
router.get('/list/:vaultId', auth, async (req, res) => {
  try {
    const vault = await Vault.findOne({ _id: req.params.vaultId, user: req.user.id });
    if (!vault) {
      return res.status(404).json({ message: 'Vault not found' });
    }

    const credentials = await Credential.find({ vault: req.params.vaultId });
    res.json(credentials);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get credential by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const credential = await Credential.findById(req.params.id).populate('vault');
    if (!credential) {
      return res.status(404).json({ message: 'Credential not found' });
    }

    const vault = await Vault.findOne({ _id: credential.vault._id, user: req.user.id });
    if (!vault) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(credential);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update credential
router.put('/:id', auth, async (req, res) => {
  try {
    const credential = await Credential.findById(req.params.id).populate('vault');
    if (!credential) {
      return res.status(404).json({ message: 'Credential not found' });
    }

    const vault = await Vault.findOne({ _id: credential.vault._id, user: req.user.id });
    if (!vault) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, username, password, url, notes } = req.body;
    const updatedCredential = await Credential.findByIdAndUpdate(
      req.params.id,
      { title, username, password, url, notes },
      { new: true }
    );

    res.json(updatedCredential);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete credential
router.delete('/:id', auth, async (req, res) => {
  try {
    const credential = await Credential.findById(req.params.id).populate('vault');
    if (!credential) {
      return res.status(404).json({ message: 'Credential not found' });
    }

    const vault = await Vault.findOne({ _id: credential.vault._id, user: req.user.id });
    if (!vault) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Credential.findByIdAndDelete(req.params.id);
    res.json({ message: 'Credential deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
