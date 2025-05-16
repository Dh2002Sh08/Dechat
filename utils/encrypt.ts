import nacl from 'tweetnacl';
import { decodeUTF8, encodeBase64 } from 'tweetnacl-util';

/**
 * Encrypt a message using sender's private key and recipient's public key.
 * Returns nonce, content, and sender's public key for decryption.
 * 
 * @param message - Plaintext message
 * @param senderSecretKey - Uint8Array (derived from wallet signMessage)
 * @param recipientPublicKey - Uint8Array (derived recipient public key)
 * @param senderPublicKey - Uint8Array (sender's derived public key)
 */
export const encryptMessage = (
  message: string,
  senderSecretKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  senderPublicKey: Uint8Array
) => {
  try {
    if (!message || !senderSecretKey || !recipientPublicKey || !senderPublicKey) {
      throw new Error('Missing encryption parameters');
    }
    if (senderSecretKey.length !== 32 || recipientPublicKey.length !== 32 || senderPublicKey.length !== 32) {
      throw new Error('Invalid key length');
    }

    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageUint8 = decodeUTF8(message);

    const encrypted = nacl.box(
      messageUint8,
      nonce,
      recipientPublicKey,
      senderSecretKey
    );

    if (!encrypted) {
      throw new Error('Encryption failed');
    }

    const result = {
      nonce: encodeBase64(nonce),
      content: encodeBase64(encrypted),
      senderPublicKey: encodeBase64(senderPublicKey),
    };
    console.log('Encrypted Data:', result);
    return result;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
};