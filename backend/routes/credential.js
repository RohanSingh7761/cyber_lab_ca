const express = require('express');
const router = express.Router();
const { executeQuery } = require('../utils/hasuraClient');
const auth = require('../middleware/auth');

// Add credential (stored as file metadata)
router.post('/add', auth, async (req, res) => {
  try {
    const { vaultId, title, username, password, url, notes } = req.body;
    const userId = req.user.id;

    const checkQuery = `
      query CheckVault($vaultId: uuid!, $userId: uuid!) {
        file_vaults_by_pk(id: $vaultId) {
          creator_id
        }
        vault_access(where: {vault_id: {_eq: $vaultId}, user_id: {_eq: $userId}}) {
          id
        }
      }
    `;

    const checkResult = await executeQuery(checkQuery, { vaultId, userId });

    if (!checkResult.file_vaults_by_pk) {
      return res.status(404).json({ message: 'Vault not found' });
    }

    const hasAccess = checkResult.file_vaults_by_pk.creator_id === userId || 
                      (checkResult.vault_access && checkResult.vault_access.length > 0);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const credentialData = JSON.stringify({ title, username, password, url, notes });
    
    const mutation = `
      mutation AddFile($vaultId: uuid!, $filename: String!, $encryptedKey: String!, $fileHash: String!, $firebasePath: String!, $fileSize: bigint!, $uploadedBy: uuid!) {
        insert_files_one(object: {
          vault_id: $vaultId,
          filename: $filename,
          encrypted_aes_key: $encryptedKey,
          file_hash: $fileHash,
          firebase_path: $firebasePath,
          file_size: $fileSize,
          uploaded_by: $uploadedBy
        }) {
          id
          filename
          encrypted_aes_key
          uploaded_at
        }
      }
    `;

    const result = await executeQuery(mutation, {
      vaultId,
      filename: title,
      encryptedKey: credentialData,
      fileHash: 'credential-' + Date.now(),
      firebasePath: 'credentials/' + Date.now(),
      fileSize: credentialData.length,
      uploadedBy: userId
    });

    const file = result.insert_files_one;
    const data = JSON.parse(file.encrypted_aes_key);

    res.json({
      _id: file.id,
      id: file.id,
      title: data.title,
      username: data.username,
      password: data.password,
      url: data.url,
      notes: data.notes,
      created_at: file.uploaded_at
    });
  } catch (error) {
    console.error('Add credential error:', error);
    res.status(500).json({ message: error.message });
  }
});

// List credentials
router.get('/list/:vaultId', auth, async (req, res) => {
  try {
    const vaultId = req.params.vaultId;
    const userId = req.user.id;

    const checkQuery = `
      query CheckVault($vaultId: uuid!, $userId: uuid!) {
        file_vaults_by_pk(id: $vaultId) {
          creator_id
        }
        vault_access(where: {vault_id: {_eq: $vaultId}, user_id: {_eq: $userId}}) {
          id
        }
      }
    `;

    const checkResult = await executeQuery(checkQuery, { vaultId, userId });

    if (!checkResult.file_vaults_by_pk) {
      return res.status(404).json({ message: 'Vault not found' });
    }

    const hasAccess = checkResult.file_vaults_by_pk.creator_id === userId || 
                      (checkResult.vault_access && checkResult.vault_access.length > 0);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const query = `
      query ListFiles($vaultId: uuid!) {
        files(where: {vault_id: {_eq: $vaultId}}) {
          id
          filename
          encrypted_aes_key
          uploaded_at
        }
      }
    `;

    const result = await executeQuery(query, { vaultId });

    const credentials = (result.files || []).map(file => {
      try {
        const data = JSON.parse(file.encrypted_aes_key);
        return {
          _id: file.id,
          id: file.id,
          title: data.title || file.filename,
          username: data.username || '',
          password: data.password || '',
          url: data.url || '',
          notes: data.notes || '',
          created_at: file.uploaded_at
        };
      } catch {
        return {
          _id: file.id,
          id: file.id,
          title: file.filename,
          username: '',
          password: '',
          url: '',
          notes: '',
          created_at: file.uploaded_at
        };
      }
    });

    res.json(credentials);
  } catch (error) {
    console.error('List credentials error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get credential by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    const query = `
      query GetFile($fileId: uuid!) {
        files_by_pk(id: $fileId) {
          id
          filename
          encrypted_aes_key
          vault_id
          uploaded_at
          file_vault {
            creator_id
          }
        }
      }
    `;

    const result = await executeQuery(query, { fileId });

    if (!result.files_by_pk) {
      return res.status(404).json({ message: 'Credential not found' });
    }

    const file = result.files_by_pk;
    
    const accessQuery = `
      query CheckAccess($vaultId: uuid!, $userId: uuid!) {
        vault_access(where: {vault_id: {_eq: $vaultId}, user_id: {_eq: $userId}}) {
          id
        }
      }
    `;

    const accessResult = await executeQuery(accessQuery, { vaultId: file.vault_id, userId });

    const hasAccess = file.file_vault.creator_id === userId || 
                      (accessResult.vault_access && accessResult.vault_access.length > 0);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const data = JSON.parse(file.encrypted_aes_key);

    res.json({
      _id: file.id,
      id: file.id,
      title: data.title || file.filename,
      username: data.username || '',
      password: data.password || '',
      url: data.url || '',
      notes: data.notes || '',
      created_at: file.uploaded_at
    });
  } catch (error) {
    console.error('Get credential error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update credential
router.put('/:id', auth, async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;
    const { title, username, password, url, notes } = req.body;

    const checkQuery = `
      query CheckFile($fileId: uuid!) {
        files_by_pk(id: $fileId) {
          vault_id
          file_vault {
            creator_id
          }
        }
      }
    `;

    const checkResult = await executeQuery(checkQuery, { fileId });

    if (!checkResult.files_by_pk) {
      return res.status(404).json({ message: 'Credential not found' });
    }

    const hasAccess = checkResult.files_by_pk.file_vault.creator_id === userId;

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const credentialData = JSON.stringify({ title, username, password, url, notes });

    const mutation = `
      mutation UpdateFile($fileId: uuid!, $filename: String!, $encryptedKey: String!) {
        update_files_by_pk(pk_columns: {id: $fileId}, _set: {filename: $filename, encrypted_aes_key: $encryptedKey}) {
          id
          filename
          encrypted_aes_key
          uploaded_at
        }
      }
    `;

    const result = await executeQuery(mutation, { 
      fileId, 
      filename: title,
      encryptedKey: credentialData 
    });

    const file = result.update_files_by_pk;
    const data = JSON.parse(file.encrypted_aes_key);

    res.json({
      _id: file.id,
      id: file.id,
      title: data.title,
      username: data.username,
      password: data.password,
      url: data.url,
      notes: data.notes,
      created_at: file.uploaded_at
    });
  } catch (error) {
    console.error('Update credential error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete credential
router.delete('/:id', auth, async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;

    const checkQuery = `
      query CheckFile($fileId: uuid!) {
        files_by_pk(id: $fileId) {
          file_vault {
            creator_id
          }
        }
      }
    `;

    const checkResult = await executeQuery(checkQuery, { fileId });

    if (!checkResult.files_by_pk) {
      return res.status(404).json({ message: 'Credential not found' });
    }

    if (checkResult.files_by_pk.file_vault.creator_id !== userId) {
      return res.status(403).json({ message: 'Only vault creator can delete credentials' });
    }

    const mutation = `
      mutation DeleteFile($fileId: uuid!) {
        delete_files_by_pk(id: $fileId) {
          id
        }
      }
    `;

    await executeQuery(mutation, { fileId });
    res.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('Delete credential error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
