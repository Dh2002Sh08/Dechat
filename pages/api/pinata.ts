import axios from 'axios';

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_KEY as string;
const PINATA_API_SECRET = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY as string;
const PINATA_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

// const GATEWAY_PREFIX = 'https://coffee-peculiar-thrush-870.mypinata.cloud/ipfs/';

// ✅ Core function to upload a file (text or image) to Pinata
export const uploadToPinata = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(PINATA_URL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_API_SECRET,
      },
    });

    const ipfsHash = response.data.IpfsHash;
    return `${ipfsHash}`;
  } catch (error) {
    console.error('❌ Error uploading to Pinata:', error);
    throw new Error('Failed to upload to Pinata');
  }
};

// ✅ Create and upload message metadata (text + optional image)
export const uploadChatMessage = async ({
  sender,
  receiver,
  message,
  imageFile,
}: {
  sender: string;
  receiver: string;
  message: string;
  imageFile?: File;
}): Promise<string> => {
  try {
    let imageUrl: string | undefined = undefined;

    if (imageFile) {
      imageUrl = await uploadToPinata(imageFile);
    }

    const metadata = {
      sender,
      receiver,
      message,
      image: imageUrl || null,
      timestamp: new Date().toISOString(),
    };

    const metadataBlob = new Blob([JSON.stringify(metadata)], {
      type: 'application/json',
    });

    const metadataFile = new File([metadataBlob], 'chat.json', {
      type: 'application/json',
    });

    const metadataIpfsUrl = await uploadToPinata(metadataFile);
    return metadataIpfsUrl;
  } catch (err) {
    console.error('❌ Failed to upload chat metadata:', err);
    throw new Error('Chat message upload failed');
  }
};

export const uploadEncryptedJson = async (encryptedJson: object): Promise<string> => {
  const blob = new Blob([JSON.stringify(encryptedJson)], { type: 'application/json' })
  const file = new File([blob], 'encrypted-message.json', { type: 'application/json' })
  return await uploadToPinata(file)
}
