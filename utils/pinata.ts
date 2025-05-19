// utils/pinata.ts

// You can store the token in an env variable during build
const API_SECRET_TOKEN = process.env.API_TOKEN;

// ✅ Upload a file to your secure API
export const uploadToPinata = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/pinata', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_SECRET_TOKEN}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload to Pinata');
    }

    const data = await response.json();
    return data.ipfsHash;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload to Pinata');
  }
};

// ✅ Upload metadata (text + optional image) to IPFS
export const uploadChatMessage = async ({
  sender,
  receiver,
  nonce,
  content,
  imageFile,
}: {
  sender: string;
  receiver: string;
  nonce: string;
  content: string;
  imageFile?: File;
}): Promise<string> => {
  try {
    let imageUrl: string | undefined;

    if (imageFile) {
      imageUrl = await uploadToPinata(imageFile);
    }

    const metadata = {
      sender,
      receiver,
      nonce,
      content,
      image: imageUrl || null,
      timestamp: new Date().toISOString(),
    };

    const metadataBlob = new Blob([JSON.stringify(metadata)], {
      type: 'application/json',
    });

    const metadataFile = new File([metadataBlob], 'chat.json', {
      type: 'application/json',
    });

    return await uploadToPinata(metadataFile);
  } catch (error) {
    console.error('Chat message upload error:', error);
    throw new Error('Chat message upload failed');
  }
};

// ✅ Upload encrypted JSON object
export const uploadEncryptedJson = async (encryptedJson: object): Promise<string> => {
  const blob = new Blob([JSON.stringify(encryptedJson)], {
    type: 'application/json',
  });
  const file = new File([blob], 'encrypted-message.json', {
    type: 'application/json',
  });

  return await uploadToPinata(file);
};
