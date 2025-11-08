const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { executeQuery } = require('../utils/HasuraClient');
const { generateInvitationToken } = require('../utils/crypto');

const router = express.Router();

// Create vault
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const { name, publicKey, encryptedPrivateKey } = req.body;
        const userId = req.userId;

        if (!name || !publicKey || !encryptedPrivateKey) {
            return res.status(400).json({ error: 'Name, publicKey, and encryptedPrivateKey required' });
        }

        // Insert vault
        const vaultQuery = `
            mutation InsertVault($name: String!, $creator_id: uuid!, $public_key: String!) {
                insert_file_vaults_one(object: {
                    name: $name,
                    creator_id: $creator_id,
                    public_key: $public_key
                }) {
                    id
                    name
                    created_at
                }
            }
        `;
        const vaultResult = await executeQuery(vaultQuery, {
            name,
            creator_id: userId,
            public_key: publicKey
        });

        const vault = vaultResult.insert_file_vaults_one;

        // Grant creator access
        const accessQuery = `
            mutation InsertVaultAccess($vault_id: uuid!, $user_id: uuid!, $encrypted_private_key: String!) {
                insert_vault_access_one(object: {
                    vault_id: $vault_id,
                    user_id: $user_id,
                    encrypted_private_key: $encrypted_private_key
                }) {
                    id
                }
            }
        `;
        await executeQuery(accessQuery, {
            vault_id: vault.id,
            user_id: userId,
            encrypted_private_key: encryptedPrivateKey
        });

        res.status(201).json({ vault });
    } catch (error) {
        console.error('Create vault error:', error);
        res.status(500).json({ error: 'Failed to create vault' });
    }
});

// Get user's vaults
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;

        const query = `
            query GetUserVaults($user_id: uuid!) {
                vault_access(where: {user_id: {_eq: $user_id}}) {
                    file_vault {
                        id
                        name
                        created_at
                        creator_id
                    }
                    encrypted_private_key
                }
            }
        `;
        const result = await executeQuery(query, { user_id: userId });

        const vaults = result.vault_access.map(access => ({
            ...access.file_vault,
            encryptedPrivateKey: access.encrypted_private_key,
            isOwner: access.file_vault.creator_id === userId
        }));

        res.json({ vaults });
    } catch (error) {
        console.error('List vaults error:', error);
        res.status(500).json({ error: 'Failed to fetch vaults' });
    }
});

// Generate invitation token
router.post('/generate-invitation', authenticateToken, async (req, res) => {
    try {
        const { vaultId } = req.body;
        const userId = req.userId;

        if (!vaultId) {
            return res.status(400).json({ error: 'Vault ID required' });
        }

        // Check if user is the creator
        const checkQuery = `
            query CheckVaultOwner($vault_id: uuid!, $creator_id: uuid!) {
                file_vaults(where: {id: {_eq: $vault_id}, creator_id: {_eq: $creator_id}}) {
                    id
                    public_key
                }
            }
        `;
        const checkResult = await executeQuery(checkQuery, {
            vault_id: vaultId,
            creator_id: userId
        });

        if (checkResult.file_vaults.length === 0) {
            return res.status(403).json({ error: 'Only vault creator can generate invitations' });
        }

        const invitationToken = generateInvitationToken();
        const vault = checkResult.file_vaults[0];

        res.json({
            invitationToken,
            vaultId,
            publicKey: vault.public_key
        });
    } catch (error) {
        console.error('Generate invitation error:', error);
        res.status(500).json({ error: 'Failed to generate invitation' });
    }
});

// Verify invitation and return vault details
router.post('/verify-invitation', authenticateToken, async (req, res) => {
    try {
        const { vaultId, invitationToken } = req.body;

        if (!vaultId || !invitationToken) {
            return res.status(400).json({ error: 'Vault ID and invitation token required' });
        }

        // Get vault details
        const vaultQuery = `
            query GetVaultWithCreatorKey($vault_id: uuid!) {
                file_vaults_by_pk(id: $vault_id) {
                    id
                    name
                    public_key
                    creator_id
                }
            }
        `;
        const vaultResult = await executeQuery(vaultQuery, { vault_id: vaultId });

        if (!vaultResult.file_vaults_by_pk) {
            return res.status(404).json({ error: 'Vault not found' });
        }

        const vault = vaultResult.file_vaults_by_pk;

        // Get creator's encrypted private key - this will be shared with all users
        const creatorKeyQuery = `
            query GetCreatorKey($vault_id: uuid!, $creator_id: uuid!) {
                vault_access(where: {vault_id: {_eq: $vault_id}, user_id: {_eq: $creator_id}}) {
                    encrypted_private_key
                }
            }
        `;
        const keyResult = await executeQuery(creatorKeyQuery, {
            vault_id: vaultId,
            creator_id: vault.creator_id
        });

        if (!keyResult.vault_access || keyResult.vault_access.length === 0) {
            return res.status(404).json({ error: 'Vault access not found' });
        }

        // Return the encrypted private key - all users will use the same encrypted key
        // They decrypt it with the vault password they know
        res.json({
            vaultName: vault.name,
            encryptedPrivateKey: keyResult.vault_access[0].encrypted_private_key
        });
    } catch (error) {
        console.error('Verify invitation error:', error);
        res.status(500).json({ error: 'Failed to verify invitation' });
    }
});

// Access vault with invitation
router.post('/access', authenticateToken, async (req, res) => {
    try {
        const { vaultId, invitationToken, encryptedPrivateKey } = req.body;
        const userId = req.userId;

        if (!vaultId || !invitationToken || !encryptedPrivateKey) {
            return res.status(400).json({ error: 'Vault ID, invitation token, and encrypted private key required' });
        }

        // Verify vault exists
        const vaultQuery = `
            query GetVault($vault_id: uuid!) {
                file_vaults_by_pk(id: $vault_id) {
                    id
                    name
                    public_key
                    creator_id
                }
            }
        `;
        const vaultResult = await executeQuery(vaultQuery, { vault_id: vaultId });

        if (!vaultResult.file_vaults_by_pk) {
            return res.status(404).json({ error: 'Vault not found' });
        }

        const vault = vaultResult.file_vaults_by_pk;

        // Check if user already has access
        const checkAccessQuery = `
            query CheckAccess($vault_id: uuid!, $user_id: uuid!) {
                vault_access(where: {vault_id: {_eq: $vault_id}, user_id: {_eq: $user_id}}) {
                    id
                }
            }
        `;
        const accessCheck = await executeQuery(checkAccessQuery, { vault_id: vaultId, user_id: userId });

        if (accessCheck.vault_access.length > 0) {
            return res.status(400).json({ error: 'You already have access to this vault' });
        }

        // Grant access - store the same encrypted private key (encrypted with vault password)
        // All users share the same encrypted private key
        const grantQuery = `
            mutation GrantAccess($vault_id: uuid!, $user_id: uuid!, $encrypted_private_key: String!) {
                insert_vault_access_one(object: {
                    vault_id: $vault_id,
                    user_id: $user_id,
                    encrypted_private_key: $encrypted_private_key
                }) {
                    id
                }
            }
        `;
        
        await executeQuery(grantQuery, {
            vault_id: vaultId,
            user_id: userId,
            encrypted_private_key: encryptedPrivateKey
        });

        res.json({
            message: 'Access granted',
            vault: vault
        });
    } catch (error) {
        console.error('Access vault error:', error);
        res.status(500).json({ error: 'Failed to grant access' });
    }
});

// Get vault details
router.get('/:vaultId', authenticateToken, async (req, res) => {
    try {
        const { vaultId } = req.params;
        const userId = req.userId;

        // Check access
        const query = `
            query GetVaultDetails($vault_id: uuid!, $user_id: uuid!) {
                vault_access(where: {vault_id: {_eq: $vault_id}, user_id: {_eq: $user_id}}) {
                    encrypted_private_key
                    file_vault {
                        id
                        name
                        public_key
                        created_at
                        creator_id
                    }
                }
            }
        `;
        const result = await executeQuery(query, { vault_id: vaultId, user_id: userId });

        if (result.vault_access.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const access = result.vault_access[0];
        res.json({
            vault: {
                ...access.file_vault,
                encryptedPrivateKey: access.encrypted_private_key,
                isOwner: access.file_vault.creator_id === userId
            }
        });
    } catch (error) {
        console.error('Get vault error:', error);
        res.status(500).json({ error: 'Failed to fetch vault details' });
    }
});

module.exports = router;
