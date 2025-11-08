import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../utils/axiosInstance';

export default function Dashboard() {
    const [vaults, setVaults] = useState([]);
    const [loading, setLoading] = useState(true);
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        fetchVaults();
    }, []);

    const fetchVaults = async () => {
        try {
            const { data } = await axiosInstance.get('/vault/list');
            setVaults(data.vaults);
        } catch (error) {
            console.error('Failed to fetch vaults:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <header className="border-b border-border bg-gradient-to-r from-surface/80 to-black/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary via-primary to-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary/30">
                                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                SecureVault
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                            <div className="hidden sm:flex items-center gap-2 px-3 sm:px-4 py-2 bg-surface/50 rounded-lg border border-border">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-primary via-primary to-orange-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold">
                                    {user?.email?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <span className="text-gray-400 text-xs sm:text-sm hidden md:inline">{user?.email}</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-400 hover:text-white hover:bg-surface/50 rounded-lg border border-border transition-all"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                {/* Hero Section */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 mb-8 sm:mb-12">
                    <div>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2 sm:mb-3">
                            Your Vaults
                        </h2>
                        <p className="text-sm sm:text-base lg:text-lg text-gray-400">
                            Securely store and share your encrypted files
                        </p>
                    </div>
                    <div className="flex gap-2 sm:gap-3 w-full lg:w-auto">
                        <button
                            onClick={() => navigate('/access-vault')}
                            className="flex-1 lg:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-surface border border-primary/50 text-primary font-semibold rounded-lg hover:bg-primary/10 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                        >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                            <span className="hidden sm:inline">Access Shared</span>
                            <span className="sm:hidden">Access</span>
                        </button>
                        <button
                            onClick={() => navigate('/create-vault')}
                            className="flex-1 lg:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-primary via-primary to-orange-500 hover:from-orange-500 hover:to-primary text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] shadow-lg shadow-primary/30 flex items-center justify-center gap-2 text-sm sm:text-base"
                        >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="hidden sm:inline">Create Vault</span>
                            <span className="sm:hidden">Create</span>
                        </button>
                    </div>
                </div>

                {/* Vaults Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <svg className="animate-spin h-12 w-12 text-primary mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-gray-400">Loading vaults...</p>
                        </div>
                    </div>
                ) : vaults.length === 0 ? (
                    <div className="bg-gradient-to-br from-surface/50 to-black border border-border rounded-2xl p-16 text-center backdrop-blur-xl">
                        <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">No vaults yet</h3>
                        <p className="text-gray-400 mb-8 max-w-md mx-auto">
                            Create your first vault to start storing encrypted files securely
                        </p>
                        <button
                            onClick={() => navigate('/create-vault')}
                            className="px-8 py-3 bg-gradient-to-r from-primary to-orange-600 hover:from-orange-600 hover:to-primary text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] shadow-lg shadow-primary/50 inline-flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Your First Vault
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {vaults.map((vault) => (
                            <div
                                key={vault.id}
                                onClick={() => navigate(`/vault/${vault.id}`)}
                                className="group bg-gradient-to-br from-surface/50 to-black border-2 border-border rounded-2xl p-4 sm:p-6 hover:border-primary transition-all cursor-pointer backdrop-blur-xl transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/20"
                            >
                                <div className="flex items-start justify-between mb-3 sm:mb-4">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary/20 to-orange-600/20 rounded-xl flex items-center justify-center group-hover:from-primary/30 group-hover:to-orange-600/30 transition-all">
                                        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    {vault.isOwner && (
                                        <span className="px-2 sm:px-3 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full border border-primary/30">
                                            Owner
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-lg sm:text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors truncate">
                                    {vault.name}
                                </h3>
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {new Date(vault.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Stats Section */}
                {vaults.length > 0 && (
                    <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-gradient-to-br from-surface/50 to-black border border-border rounded-2xl p-6 backdrop-blur-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h4 className="text-gray-400 text-sm font-medium">Total Vaults</h4>
                            </div>
                            <p className="text-3xl font-bold text-white">{vaults.length}</p>
                        </div>
                        <div className="bg-gradient-to-br from-surface/50 to-black border border-border rounded-2xl p-6 backdrop-blur-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                </div>
                                <h4 className="text-gray-400 text-sm font-medium">Owned by You</h4>
                            </div>
                            <p className="text-3xl font-bold text-white">{vaults.filter(v => v.isOwner).length}</p>
                        </div>
                        <div className="bg-gradient-to-br from-surface/50 to-black border border-border rounded-2xl p-6 backdrop-blur-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                </div>
                                <h4 className="text-gray-400 text-sm font-medium">Shared with You</h4>
                            </div>
                            <p className="text-3xl font-bold text-white">{vaults.filter(v => !v.isOwner).length}</p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
