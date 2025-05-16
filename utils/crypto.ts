/**
 * Derive an AES key from a passphrase using PBKDF2.
 * @param passphrase - User-provided passphrase
 * @returns CryptoKey for AES-GCM
 */
async function deriveKey(passphrase: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const salt = encoder.encode('chat-app-salt'); // Fixed salt for consistency
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }
  
  /**
   * Encrypt a message using AES-GCM.
   * @param message - Plaintext message
   * @param passphrase - Shared passphrase
   * @returns Encrypted data with nonce
   */
  export async function encryptMessage(message: string, passphrase: string): Promise<{ nonce: string; content: string }> {
    try {
      if (!message || !passphrase) throw new Error('Missing message or passphrase');
      const key = await deriveKey(passphrase);
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const nonce = crypto.getRandomValues(new Uint8Array(12)); // 12-byte nonce for AES-GCM
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        key,
        data
      );
      const result = {
        nonce: Buffer.from(nonce).toString('base64'),
        content: Buffer.from(encrypted).toString('base64'),
      };
      console.log('Encrypted Data:', result);
      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  }
  
  /**
   * Decrypt a message using AES-GCM.
   * @param encryptedData - Object with nonce and content
   * @param passphrase - Shared passphrase
   * @returns Decrypted plaintext
   */
  export async function decryptMessage(
    encryptedData: { nonce: string; content: string },
    passphrase: string
  ): Promise<string> {
    try {
      if (!encryptedData.nonce || !encryptedData.content || !passphrase) {
        throw new Error('Invalid encrypted data or passphrase');
      }
      const key = await deriveKey(passphrase);
      const nonce = Buffer.from(encryptedData.nonce, 'base64');
      const content = Buffer.from(encryptedData.content, 'base64');
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce },
        key,
        content
      );
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  }