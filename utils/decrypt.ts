import nacl from 'tweetnacl';
import { decodeBase64, encodeUTF8 } from 'tweetnacl-util';

/**
 * Decrypt message sent by self (we know the other party's public key)
 */
export const decryptMessage = (
  encrypted: { nonce: string; content: string; senderPublicKey: string },
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): string => {
  try {
    const nonce = decodeBase64(encrypted.nonce);
    const content = decodeBase64(encrypted.content);

    if (nonce.length !== nacl.box.nonceLength || !content.length) {
      throw new Error('Invalid nonce or content');
    }

    const decrypted = nacl.box.open(
      content,
      nonce,
      recipientPublicKey,
      senderSecretKey
    );

    if (!decrypted) throw new Error('Failed to decrypt: Invalid keys or corrupted data');
    return encodeUTF8(decrypted);
  } catch (error) {
    console.error('Decryption error (sent):', error);
    throw error;
  }
};

/**
 * Decrypt message received from others (their derived pubkey is embedded)
 */
export const reverseDecryptMessage = (
  encryptedData: {
    nonce: string;
    content: string;
    senderPublicKey: string;
  },
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): string => {
  try {
    const nonce = decodeBase64(encryptedData.nonce);
    const content = decodeBase64(encryptedData.content);
    const embeddedSenderPublicKey = decodeBase64(encryptedData.senderPublicKey);

    if (nonce.length !== nacl.box.nonceLength || !content.length) {
      throw new Error('Invalid nonce or content');
    }
    if (senderPublicKey.length !== 32 || recipientSecretKey.length !== 32 || embeddedSenderPublicKey.length !== 32) {
      throw new Error('Invalid key length');
    }

    console.log('Embedded Sender Public Key:', Buffer.from(embeddedSenderPublicKey).toString('hex'));
    console.log('Provided Sender Public Key:', Buffer.from(senderPublicKey).toString('hex'));
    console.log('Recipient Secret Key:', Buffer.from(recipientSecretKey).toString('hex'));

    const decrypted = nacl.box.open(
      content,
      nonce,
      embeddedSenderPublicKey, // Use embedded key
      recipientSecretKey
    );

    if (!decrypted) throw new Error('Failed to decrypt: Invalid keys or corrupted data');
    return encodeUTF8(decrypted);
  } catch (error) {
    console.error('Decryption error (received):', error);
    throw new Error('Failed to decrypt message');
  }
};