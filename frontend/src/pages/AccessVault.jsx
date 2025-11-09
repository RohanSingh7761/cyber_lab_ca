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
            const { data } = await axiosInstance.post('/vault/verify-invitation', {
                vaultId,
                invitationToken
            });
            setVaultInfo(data);
        } catch (err) {
            setError('Invalid invitation link');
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

            // Get the vault creator's encrypted private key
            const { data: vaultData } = await axiosInstance.post('/vault/verify-invitation', {
                vaultId,
                invitationToken
            });

            // Try to decrypt the creator's private key with the password
            // This verifies the user knows the vault password
            const { decryptPrivateKey } = await import('../utils/crypto');
            try {
                await decryptPrivateKey(vaultData.encryptedPrivateKey, password);
            } catch (err) {
                setError('Incorrect vault password');
                setLoading(false);
                return;
            }

            // Re-encrypt the same private key with the user's password
            const encryptedPrivateKeyForUser = await encryptPrivateKey(
                vaultData.decryptedPrivateKey || vaultData.encryptedPrivateKey,
                password
            );

            // Request access with the encrypted private key
            await axiosInstance.post('/vault/access', {
                vaultId,
                invitationToken,
                encryptedPrivateKey: vaultData.encryptedPrivateKey // Use the same encrypted key
            });

            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to access vault');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black">
            <header className="border-b border-border bg-linear-to-r from-surface/80 to-black/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm sm:text-base"
                        >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-linear-to-br from-primary via-primary to-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary/30">
                            <svg className="w-4 h-4 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h1 className="text-lg sm:text-2xl font-bold text-white">Access Shared Vault</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <div className="bg-linear-to-br from-surface/50 to-black border border-border rounded-2xl p-6 sm:p-8 backdrop-blur-xl">
                    <div className="mb-6 text-center">
                        <div className="w-20 h-20 bg-linear-to-br from-primary/20 to-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Join a Vault</h2>
                        {vaultInfo ? (
                            <p className="text-gray-400">
                                Joining: <span className="text-primary font-semibold">{vaultInfo.vaultName}</span>
                            </p>
                        ) : (
                            <p className="text-gray-400">Enter the vault details to gain access</p>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
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
                                className="w-full px-4 py-3 bg-black/50 border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono"
                                placeholder="Enter vault ID"
                                required
                                disabled={searchParams.get('vaultId')}
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
                                className="w-full px-4 py-3 bg-black/50 border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono"
                                placeholder="Enter invitation token"
                                required
                                disabled={searchParams.get('token')}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Vault Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-black/50 border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                placeholder="Enter the vault password"
                                required
                                minLength={8}
                            />
                            <p className="text-sm text-gray-500 mt-2">
                                You must know the vault password to access this vault
                            </p>
                        </div>

                        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                            <div className="flex gap-3">
                                <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="text-sm font-medium text-primary mb-1">Shared Vault Access</p>
                                    <p className="text-sm text-gray-300">
                                        The vault owner should have shared the vault password with you. Both the owner and you will use the same password to access the vault.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-linear-to-r from-primary to-orange-600 hover:from-orange-600 hover:to-primary text-white font-semibold py-3 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/50"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Accessing Vault...
                                </span>
                            ) : 'Access Vault'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
