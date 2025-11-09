import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { generateVaultKeypair, encryptPrivateKey } from '../utils/crypto';

export default function CreateVault() {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            // Generate keypair locally
            const { publicKey, privateKey } = await generateVaultKeypair();

            // Encrypt private key with password
            const encryptedPrivateKey = await encryptPrivateKey(privateKey, password);

            // Create vault
            await axiosInstance.post('/vault/create', {
                name,
                publicKey,
                encryptedPrivateKey
            });

            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create vault');
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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <h1 className="text-lg sm:text-2xl font-bold text-white">Create New Vault</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <div className="bg-linear-to-br from-surface/50 to-black border border-border rounded-2xl p-6 sm:p-8 backdrop-blur-xl">
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
                                Vault Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 bg-black/50 border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                placeholder="My Secure Vault"
                                required
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
                                placeholder="Secure password for this vault"
                                required
                                minLength={8}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-black/50 border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                placeholder="Confirm your password"
                                required
                                minLength={8}
                            />
                            <p className="text-sm text-gray-500 mt-2">
                                This password encrypts your vault's private key. Keep it safe!
                            </p>
                        </div>

                        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                            <div className="flex gap-3">
                                <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="text-sm font-medium text-primary mb-1">Important Security Information</p>
                                    <p className="text-sm text-gray-300">
                                        A keypair will be generated locally in your browser. The private key will be encrypted with your password. Never share your vault password!
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
                                    Creating Vault...
                                </span>
                            ) : 'Create Vault'}
                        </button>
                    </form>
                </div>

                {/* Features */}
                <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-surface/30 border border-border rounded-xl p-3 sm:p-4 text-center">
                        <div className="text-xl sm:text-2xl mb-2">🔐</div>
                        <p className="text-xs text-gray-400">RSA-2048<br/>Encryption</p>
                    </div>
                    <div className="bg-surface/30 border border-border rounded-xl p-3 sm:p-4 text-center">
                        <div className="text-xl sm:text-2xl mb-2">🔑</div>
                        <p className="text-xs text-gray-400">AES-256<br/>Security</p>
                    </div>
                    <div className="bg-surface/30 border border-border rounded-xl p-3 sm:p-4 text-center">
                        <div className="text-xl sm:text-2xl mb-2">✅</div>
                        <p className="text-xs text-gray-400">SHA-256<br/>Integrity</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
