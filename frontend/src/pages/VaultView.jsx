import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import axiosInstance from '../utils/axiosInstance';
import {
    generateAESKey,
    encryptFile,
    decryptFile,
    wrapAESKey,
    unwrapAESKey,
    hashFile,
    decryptPrivateKey
} from '../utils/crypto';

export default function VaultView() {
    const { vaultId } = useParams();
    const navigate = useNavigate();
    const [vault, setVault] = useState(null);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [downloadingId, setDownloadingId] = useState(null);
    const [showInvite, setShowInvite] = useState(false);
    const [invitationLink, setInvitationLink] = useState('');
    const [password, setPassword] = useState('');
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [error, setError] = useState('');
    const [privateKey, setPrivateKey] = useState(null);
    const [pendingFile, setPendingFile] = useState(null);

    useEffect(() => {
        fetchVaultDetails();
        fetchFiles();
        // Prompt for password immediately on mount
        setShowPasswordPrompt(true);
    }, [vaultId]);

    const fetchVaultDetails = async () => {
        try {
            const { data } = await axiosInstance.get(`/vault/${vaultId}`);
            setVault(data.vault);
        } catch (error) {
            console.error('Failed to fetch vault:', error);
            setError('Failed to load vault details');
        } finally {
            setLoading(false);
        }
    };

    const fetchFiles = async () => {
        try {
            const { data } = await axiosInstance.get(`/file/list/${vaultId}`);
            setFiles(data.files);
        } catch (error) {
            console.error('Failed to fetch files:', error);
        }
    };

    const unlockVault = async () => {
        try {
            setError('');
            const decryptedPrivateKey = await decryptPrivateKey(vault.encryptedPrivateKey, password);
            setPrivateKey(decryptedPrivateKey);
            setShowPasswordPrompt(false);
            setPassword('');
            
            // If there's a pending file, upload it now
            if (pendingFile) {
                await performFileUpload(pendingFile);
                setPendingFile(null);
            }
        } catch (err) {
            setError('Incorrect password');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!privateKey) {
            setPendingFile(file);
            setShowPasswordPrompt(true);
            return;
        }

        await performFileUpload(file);
        e.target.value = '';
    };

    const performFileUpload = async (file) => {
        setUploading(true);
        setError('');
        setUploadProgress('Generating encryption key...');

        try {
            // Generate AES key for this file
            const aesKey = await generateAESKey();

            setUploadProgress('Encrypting file...');
            // Encrypt file
            const encryptedData = await encryptFile(file, aesKey);

            setUploadProgress('Generating file hash...');
            // Hash original file
            const fileHash = await hashFile(file);

            setUploadProgress('Uploading to secure storage...');
            // Upload to Firebase
            const firebasePath = `vaults/${vaultId}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, firebasePath);
            const blob = new Blob([encryptedData]);
            await uploadBytes(storageRef, blob);

            setUploadProgress('Securing encryption key...');
            // Wrap AES key with vault public key
            const encryptedAesKey = await wrapAESKey(aesKey, vault.public_key);

            setUploadProgress('Saving metadata...');
            // Save metadata to backend
            await axiosInstance.post('/file/upload', {
                vaultId,
                filename: file.name,
                encryptedAesKey,
                fileHash,
                firebasePath,
                fileSize: file.size
            });

            setUploadProgress('Upload complete!');
            setTimeout(() => setUploadProgress(''), 2000);

            // Refresh file list
            fetchFiles();
        } catch (err) {
            console.error('Upload failed:', err);
            setError('Failed to upload file');
            setUploadProgress('');
        } finally {
            setUploading(false);
        }
    };

    const handleFileDownload = async (file) => {
        if (!privateKey) {
            setShowPasswordPrompt(true);
            return;
        }

        setDownloadingId(file.id);
        setError('');

        try {
            // Fetch file metadata
            const { data } = await axiosInstance.get(`/file/${file.id}`);
            const fileMetadata = data.file;

            // Download from Firebase - use fetch with proper mode
            const storageRef = ref(storage, fileMetadata.firebase_path);
            const downloadUrl = await getDownloadURL(storageRef);
            
            // Fetch the file data
            const response = await fetch(downloadUrl, {
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': 'application/octet-stream'
                }
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.statusText}`);
            }

            const encryptedArrayBuffer = await response.arrayBuffer();
            const encryptedData = new Uint8Array(encryptedArrayBuffer);

            // Unwrap AES key
            const aesKey = await unwrapAESKey(fileMetadata.encrypted_aes_key, privateKey);

            // Decrypt file
            const decryptedData = await decryptFile(encryptedData, aesKey);

            // Verify hash
            const decryptedBlob = new Blob([decryptedData]);
            const decryptedFile = new File([decryptedBlob], fileMetadata.filename);
            const computedHash = await hashFile(decryptedFile);

            if (computedHash !== fileMetadata.file_hash) {
                throw new Error('File integrity check failed');
            }

            // Download file
            const url = window.URL.createObjectURL(decryptedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileMetadata.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Download failed:', err);
            setError('Failed to download file: ' + err.message);
        } finally {
            setDownloadingId(null);
        }
    };

    const generateInvitation = async () => {
        try {
            const { data } = await axiosInstance.post('/vault/generate-invitation', { vaultId });
            const link = `${window.location.origin}/access-vault?vaultId=${vaultId}&token=${data.invitationToken}`;
            setInvitationLink(link);
            setShowInvite(true);
        } catch (err) {
            setError('Failed to generate invitation');
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(invitationLink);
        alert('Invitation link copied!');
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <svg className="animate-spin h-12 w-12 text-primary mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-400">Loading vault...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <header className="border-b border-border bg-gradient-to-r from-surface/80 to-black/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 sm:gap-2 text-sm sm:text-base flex-shrink-0"
                            >
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                <span className="hidden sm:inline">Back</span>
                            </button>
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary via-primary to-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary/30 flex-shrink-0">
                                    <svg className="w-4 h-4 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h1 className="text-lg sm:text-2xl font-bold text-white truncate">{vault?.name}</h1>
                                    <p className="text-xs sm:text-sm text-gray-400 truncate">
                                        {vault?.isOwner ? '👑 You own this vault' : '🔗 Shared with you'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        {vault?.isOwner && (
                            <button
                                onClick={generateInvitation}
                                className="px-3 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-primary via-primary to-orange-500 hover:from-orange-500 hover:to-primary text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] shadow-lg shadow-primary/30 flex items-center gap-1 sm:gap-2 text-xs sm:text-base flex-shrink-0"
                            >
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                <span className="hidden sm:inline">Share Vault</span>
                                <span className="sm:hidden">Share</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Upload Progress Banner */}
                {uploadProgress && (
                    <div className="mb-6 bg-primary/10 border border-primary/50 text-primary px-4 py-3 rounded-lg flex items-center gap-3 animate-pulse">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="font-medium">{uploadProgress}</span>
                    </div>
                )}

                {/* Upload Section */}
                <div className="bg-gradient-to-br from-surface/50 to-black border border-border rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 backdrop-blur-xl">
                    <h2 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-base sm:text-xl">Upload File</span>
                    </h2>
                    <label className="flex-1 cursor-pointer">
                        <input
                            type="file"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            className="hidden"
                            id="file-upload"
                        />
                        <div className="flex items-center justify-center w-full px-6 py-8 bg-black/50 border-2 border-dashed border-border rounded-xl hover:border-primary transition-all group">
                            <div className="text-center">
                                <svg className="w-12 h-12 text-gray-500 group-hover:text-primary transition-colors mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="text-gray-400 mb-1">
                                    {uploading ? 'Uploading...' : 'Click to select file or drag and drop'}
                                </p>
                                <p className="text-sm text-gray-500">All files are encrypted before upload</p>
                            </div>
                        </div>
                    </label>
                    {!privateKey && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-gray-400 bg-primary/10 border border-primary/30 rounded-lg p-3">
                            <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Unlock vault with password to upload files
                        </div>
                    )}
                </div>

                {/* Files List */}
                <div className="bg-gradient-to-br from-surface/50 to-black border border-border rounded-2xl overflow-hidden backdrop-blur-xl">
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border flex items-center justify-between">
                        <h2 className="text-lg sm:text-xl font-semibold text-white flex items-center gap-2">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-base sm:text-xl">Files ({files.length})</span>
                        </h2>
                    </div>
                    {files.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <p className="text-gray-400 mb-2">No files uploaded yet</p>
                            <p className="text-sm text-gray-500">Upload your first file to get started</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {files.map((file) => (
                                <div
                                    key={file.id}
                                    className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 hover:bg-surface/30 transition-all group"
                                >
                                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary/20 to-orange-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm sm:text-base text-white font-medium group-hover:text-primary transition-colors truncate">
                                                {file.filename}
                                            </h3>
                                            <p className="text-xs sm:text-sm text-gray-400 flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                                    </svg>
                                                    {formatFileSize(file.file_size)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    {new Date(file.uploaded_at).toLocaleDateString()}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleFileDownload(file)}
                                        disabled={downloadingId === file.id}
                                        className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-primary via-primary to-orange-500 hover:from-orange-500 hover:to-primary text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 shadow-lg shadow-primary/30 flex items-center justify-center gap-2 text-sm sm:text-base flex-shrink-0"
                                    >
                                        {downloadingId === file.id ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Downloading...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                Download
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Password Prompt Modal */}
            {showPasswordPrompt && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gradient-to-br from-surface to-black border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-primary to-orange-600 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Unlock Vault</h3>
                                <p className="text-sm text-gray-400">Enter your password to access this vault</p>
                            </div>
                        </div>
                        {error && (
                            <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 px-3 py-2 rounded-lg text-sm">
                                {error}
                            </div>
                        )}
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && unlockVault()}
                            className="w-full px-4 py-3 bg-black/50 border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-4 transition-all"
                            placeholder="Vault password"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowPasswordPrompt(false);
                                    setPassword('');
                                    setError('');
                                    setPendingFile(null);
                                    navigate('/dashboard');
                                }}
                                className="flex-1 px-4 py-2.5 bg-surface border border-border text-white rounded-lg hover:bg-border transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={unlockVault}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary to-orange-600 hover:from-orange-600 hover:to-primary text-white rounded-lg transition-all shadow-lg shadow-primary/50"
                            >
                                Unlock
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invitation Modal */}
            {showInvite && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gradient-to-br from-surface to-black border border-border rounded-2xl p-6 max-w-2xl w-full shadow-2xl mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-primary to-orange-600 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Share Vault</h3>
                                <p className="text-sm text-gray-400">Share this link to grant access</p>
                            </div>
                        </div>
                        <div className="bg-black/50 border border-border rounded-lg p-4 mb-4">
                            <code className="text-white text-sm break-all">{invitationLink}</code>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowInvite(false)}
                                className="flex-1 px-4 py-2.5 bg-surface border border-border text-white rounded-lg hover:bg-border transition-all"
                            >
                                Close
                            </button>
                            <button
                                onClick={copyToClipboard}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary to-orange-600 hover:from-orange-600 hover:to-primary text-white rounded-lg transition-all shadow-lg shadow-primary/50 flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy Link
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
