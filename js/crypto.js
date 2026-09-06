/* AES-256-GCM with PBKDF2-SHA-256 password derivation (Web Crypto). */

const VAULT_KDF_ITERATIONS = 210000;

function bytesToB64(bytes) {
    let binary = '';
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    arr.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
}

function b64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function randomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

async function deriveVaultKey(password, saltBytes, iterations = VAULT_KDF_ITERATIONS) {
    const baseKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptJson(key, data) {
    const iv = randomBytes(12);
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return {
        v: 1,
        alg: 'AES-256-GCM',
        iv: bytesToB64(iv),
        ct: bytesToB64(new Uint8Array(cipherBuf))
    };
}

async function decryptJson(key, envelope) {
    if (!envelope || envelope.alg !== 'AES-256-GCM' || !envelope.iv || !envelope.ct) {
        throw new Error('Not a DermRecord encrypted file.');
    }
    const iv = b64ToBytes(envelope.iv);
    const ct = b64ToBytes(envelope.ct);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(plainBuf));
}
