// Generate RSA keypair for vault
export async function generateVaultKeypair() {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256'
        },
        true,
        ['encrypt', 'decrypt']
    );

    const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
        publicKey: arrayBufferToBase64(publicKey),
        privateKey: arrayBufferToBase64(privateKey)
    };
}

// Generate AES key for file encryption
export async function generateAESKey() {
    return await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

// Encrypt file with AES
export async function encryptFile(file, aesKey) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const fileBuffer = await file.arrayBuffer();

    const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        fileBuffer
    );

    // Prepend IV to encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return result;
}

// Decrypt file with AES
export async function decryptFile(encryptedData, aesKey) {
    const iv = encryptedData.slice(0, 12);
    const data = encryptedData.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        data
    );

    return decrypted;
}

// Wrap AES key with RSA public key
export async function wrapAESKey(aesKey, publicKeyBase64) {
    const publicKey = await importPublicKey(publicKeyBase64);
    const wrappedKey = await window.crypto.subtle.wrapKey(
        'raw',
        aesKey,
        publicKey,
        { name: 'RSA-OAEP' }
    );
    return arrayBufferToBase64(wrappedKey);
}

// Unwrap AES key with RSA private key
export async function unwrapAESKey(wrappedKeyBase64, privateKeyBase64) {
    const privateKey = await importPrivateKey(privateKeyBase64);
    const wrappedKey = base64ToArrayBuffer(wrappedKeyBase64);

    const aesKey = await window.crypto.subtle.unwrapKey(
        'raw',
        wrappedKey,
        privateKey,
        { name: 'RSA-OAEP' },
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    return aesKey;
}

// Hash file for integrity check
export async function hashFile(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    return arrayBufferToHex(hashBuffer);
}

// Encrypt private key with user password (for storage)
export async function encryptPrivateKey(privateKeyBase64, password) {
    const passwordKey = await deriveKeyFromPassword(password);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);

    const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        passwordKey,
        privateKeyBuffer
    );

    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return arrayBufferToBase64(result.buffer);
}

// Decrypt private key with user password
export async function decryptPrivateKey(encryptedPrivateKeyBase64, password) {
    const passwordKey = await deriveKeyFromPassword(password);
    const encryptedData = base64ToArrayBuffer(encryptedPrivateKeyBase64);
    const iv = encryptedData.slice(0, 12);
    const data = encryptedData.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        passwordKey,
        data
    );

    return arrayBufferToBase64(decrypted);
}

// Helper: Derive key from password
async function deriveKeyFromPassword(password) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const salt = encoder.encode('vault-salt-2024'); // In production, use unique salt per user

    const baseKey = await window.crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

// Helper: Import public key
async function importPublicKey(publicKeyBase64) {
    const keyData = base64ToArrayBuffer(publicKeyBase64);
    return await window.crypto.subtle.importKey(
        'spki',
        keyData,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt', 'wrapKey']
    );
}

// Helper: Import private key
async function importPrivateKey(privateKeyBase64) {
    const keyData = base64ToArrayBuffer(privateKeyBase64);
    return await window.crypto.subtle.importKey(
        'pkcs8',
        keyData,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['decrypt', 'unwrapKey']
    );
}

// Helper: ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Helper: Base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Helper: ArrayBuffer to Hex
function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
