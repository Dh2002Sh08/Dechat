//api/pinata.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import formidable from 'formidable';
import { promises as fs } from 'fs';

export const config = {
  api: {
    bodyParser: false, // We need this for file uploads
  },
};

const PINATA_API_KEY = process.env.PINATA_KEY as string;
const PINATA_API_SECRET = process.env.PINATA_SECRET_KEY as string;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  });

  try {
    const [, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve([fields, files]);
      });
    });

    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileData = Array.isArray(file) ? file[0] : file;
    const fileBuffer = await fs.readFile(fileData.filepath);

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: fileData.mimetype || 'application/octet-stream' });
    formData.append('file', blob, fileData.originalFilename || 'file');

    const response = await axios.post(PINATA_URL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_API_SECRET,
      },
    });

    // Clean up the temporary file
    await fs.unlink(fileData.filepath);

    res.status(200).json({ ipfsHash: response.data.IpfsHash });
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    res.status(500).json({ error: 'Failed to upload to Pinata' });
  }
}