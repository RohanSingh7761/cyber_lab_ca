// backend/utils/file.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { executeQuery } = require('../utils/HasuraClient');

const router = express.Router();

// Upload file metadata
router.post('/upload', authenticateToken, async (req, res) => {
    try {
        const { vaultId, filename, encryptedAesKey, fileHash, firebasePath, fileSize } = req.body;
        const userId = req.userId;

        if (!vaultId || !filename || !encryptedAesKey || !fileHash || !firebasePath || !fileSize) {
            return res.status(400).json({ error: 'All file metadata required' });
        }

        // Check vault access
        const accessQuery = `
            query CheckVaultAccess($vault_id: uuid!, $user_id: uuid!) {
                vault_access(where: {vault_id: {_eq: $vault_id}, user_id: {_eq: $user_id}}) {
                    id
                }
            }
        `;
        const accessResult = await executeQuery(accessQuery, { vault_id: vaultId, user_id: userId });

        if (accessResult.vault_access.length === 0) {
            return res.status(403).json({ error: 'Access denied to this vault' });
        }

        // Insert file metadata
        const insertQuery = `
            mutation InsertFile(
                $vault_id: uuid!,
                $filename: String!,
                $encrypted_aes_key: String!,
                $file_hash: String!,
                $firebase_path: String!,
                $file_size: bigint!,
                $uploaded_by: uuid!
            ) {
                insert_files_one(object: {
                    vault_id: $vault_id,
                    filename: $filename,
                    encrypted_aes_key: $encrypted_aes_key,
                    file_hash: $file_hash,
                    firebase_path: $firebase_path,
                    file_size: $file_size,
                    uploaded_by: $uploaded_by
                }) {
                    id
                    filename
                    uploaded_at
                }
            }
        `;
        const result = await executeQuery(insertQuery, {
            vault_id: vaultId,
            filename,
            encrypted_aes_key: encryptedAesKey,
            file_hash: fileHash,
            firebase_path: firebasePath,
            file_size: fileSize,
            uploaded_by: userId
        });

        res.status(201).json({ file: result.insert_files_one });
    } catch (error) {
        console.error('Upload file metadata error:', error);
        res.status(500).json({ error: 'Failed to save file metadata' });
    }
});

// List files in vault
router.get('/list/:vaultId', authenticateToken, async (req, res) => {
    try {
        const { vaultId } = req.params;
        const userId = req.userId;

        // Check vault access
        const accessQuery = `
            query CheckVaultAccess($vault_id: uuid!, $user_id: uuid!) {
                vault_access(where: {vault_id: {_eq: $vault_id}, user_id: {_eq: $user_id}}) {
                    id
                }
            }
        `;
        const accessResult = await executeQuery(accessQuery, { vault_id: vaultId, user_id: userId });

        if (accessResult.vault_access.length === 0) {
            return res.status(403).json({ error: 'Access denied to this vault' });
        }

        // Get files
        const filesQuery = `
            query GetFiles($vault_id: uuid!) {
                files(where: {vault_id: {_eq: $vault_id}}, order_by: {uploaded_at: desc}) {
                    id
                    filename
                    file_size
                    uploaded_at
                    uploaded_by
                }
            }
        `;
        const result = await executeQuery(filesQuery, { vault_id: vaultId });

        res.json({ files: result.files });
    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// Get file metadata for download
router.get('/:fileId', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = req.userId;

        // Get file with access check
        const query = `
            query GetFileMetadata($file_id: uuid!, $user_id: uuid!) {
                files(where: {id: {_eq: $file_id}}) {
                    id
                    filename
                    encrypted_aes_key
                    file_hash
                    firebase_path
                    file_size
                    vault_id
                }
                vault_access(where: {
                    vault_id: {_eq: $file_id},
                    user_id: {_eq: $user_id}
                }) {
                    id
                }
            }
        `;
        const result = await executeQuery(query, { file_id: fileId, user_id: userId });

        if (result.files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Verify access through vault
        const file = result.files[0];
        const accessCheckQuery = `
            query CheckFileAccess($vault_id: uuid!, $user_id: uuid!) {
                vault_access(where: {vault_id: {_eq: $vault_id}, user_id: {_eq: $user_id}}) {
                    id
                }
            }
        `;
        const accessCheck = await executeQuery(accessCheckQuery, {
            vault_id: file.vault_id,
            user_id: userId
        });

        if (accessCheck.vault_access.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ file });
    } catch (error) {
        console.error('Get file metadata error:', error);
        res.status(500).json({ error: 'Failed to fetch file metadata' });
    }
});

module.exports = router;

