import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { encryptPrivateKey } from '../utils/crypto';

export default function AccessVault() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [vaultId, setVaultId] = useState(searchParams.get('vaultId') || '');
    const [invitationToken, setInvitationToken] = useState(searchParams.get('token') || '');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [vaultInfo, setVaultInfo] = useState(null);

    useEffect(() => {
        if (vaultId && invitationToken) {
            fetchVaultInfo();
        }
    }, [vaultId, invitationToken]);

    const fetchVaultInfo = async () => {
        try {
            // Vault info will be fetched during access grant
        } catch (err) {
            console.error('Failed to fetch vault info:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (!vaultId || !invitationToken || !password) {
                setError('All fields are required');
                return;
            }

            // Get vault public key
            const { data: inviteData } = await axiosInstance.post('/vault/generate-invitation', {
                vaultId
            });

            // For access, we need to wrap the private key
            // In real scenario, the invitation should include encrypted private key
            // For this demo, we'll encrypt a placeholder
            const encryptedPrivateKey = await encryptPrivateKey('dummy-key', password);

            // Request access
            await axiosInstance.post('/vault/access', {
                vaultId,
                invitationToken,
                encryptedPrivateKey
            });

            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to access vault');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-surface">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="text-gray-400 hover:text-white"
                        >
                            ← Back
                        </button>
                        <h1 className="text-2xl font-bold text-white">Access Shared Vault</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-surface border border-border rounded-lg p-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-white mb-2">Join a Vault</h2>
                        <p className="text-gray-400">
                            Enter the vault ID and invitation token to gain access
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Vault ID
                            </label>
                            <input
                                type="text"
                                value={vaultId}
                                onChange={(e) => setVaultId(e.target.value)}
                                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-white focus:outline-none focus:border-primary transition"
                                placeholder="Enter vault ID"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Invitation Token
                            </label>
                            <input
                                type="text"
                                value={invitationToken}
                                onChange={(e) => setInvitationToken(e.target.value)}
                                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-white focus:outline-none focus:border-primary transition"
                                placeholder="Enter invitation token"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Your Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-white focus:outline-none focus:border-primary transition"
                                placeholder="Create a password for this vault"
                                required
                                minLength={8}
                            />
                            <p className="text-sm text-gray-400 mt-2">
                                Create a password to encrypt your access key
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
                        >
                            {loading ? 'Requesting Access...' : 'Access Vault'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}