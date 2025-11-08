-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- File Vaults table
CREATE TABLE file_vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vault access table (tracks who can access which vault)
CREATE TABLE vault_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES file_vaults(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_private_key TEXT NOT NULL,
    invitation_token VARCHAR(255),
    access_granted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(vault_id, user_id)
);

-- Files table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES file_vaults(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    encrypted_aes_key TEXT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    firebase_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_file_vaults_creator ON file_vaults(creator_id);
CREATE INDEX idx_vault_access_vault ON vault_access(vault_id);
CREATE INDEX idx_vault_access_user ON vault_access(user_id);
CREATE INDEX idx_vault_access_token ON vault_access(invitation_token);
CREATE INDEX idx_files_vault ON files(vault_id);
