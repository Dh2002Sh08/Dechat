'use client';

import { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import { PublicKey } from '@solana/web3.js';
import { AnchorProvider, BN } from '@project-serum/anchor';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { uploadEncryptedJson, uploadChatMessage } from '@/pages/api/pinata';
import { sendMessage, fetchMessages, fetchReceiverMessages } from '@/utils/useprogram';
import { decryptMessage, encryptMessage } from '@/utils/crypto';
import InitUserProfilePage from './wallet_Address';
import { saveAs } from 'file-saver';
import logo from '../pictures/Dechat.png';
import {
  Paperclip,
  Loader,
  Send,
  Users,
  ArrowDownToLine,
  FileText,
  Info
} from 'lucide-react';
import '@fontsource/fira-code';
import Instructions from './intructions';

export default function ChatBox() {
  const [recipientKey, setRecipientKey] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<{
    text: string;
    isSender: boolean;
    timestamp: BN;
    image?: string;
  }[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [notifications, setNotifications] = useState<
    { id: number; message: string; type: 'success' | 'error' | 'info' }[]
  >([]);
  const toggleInstructions = () => setShowInstructions((prev) => !prev);

  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const provider = useMemo(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    return new AnchorProvider(
      connection,
      { publicKey, signTransaction, signAllTransactions },
      { commitment: 'processed' }
    );
  }, [connection, publicKey, signTransaction, signAllTransactions]);

  // Notification handler
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3000);
  };

  // Notification Component
  const Notification = ({ message, type, onClose }: {
    message: string;
    type: 'success' | 'error' | 'info';
    onClose: () => void;
  }) => {
    const typeStyles = {
      success: 'bg-gradient-to-br from-[#0a1930] to-[#102841]',
      error: 'bg-gradient-to-br from-red-600 to-red-800',
      info: 'bg-gradient-to-br from-blue-600 to-blue-800',
    };

    return (
      <div className={`flex items-center justify-between ${typeStyles[type]} text-white px-4 py-2 rounded-lg shadow-lg mb-2 animate-slide-in max-w-sm w-full`}>
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 font-bold text-lg leading-none"
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    );
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      showNotification(`File selected: ${selectedFile.name}`, 'info');
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSend = async () => {
    if (!provider || !publicKey || !recipientKey.trim()) {
      showNotification('Please connect wallet and select a recipient', 'error');
      return;
    }
    if (!message.trim() && !file) {
      showNotification('Please enter a message or select a file', 'error');
      return;
    }
    setIsSending(true);
    try {
      const recipient = new PublicKey(recipientKey);
      let ipfsUrl: string;

      if (message.trim() || file) {
        ipfsUrl = await uploadChatMessage({
          sender: publicKey.toString(),
          receiver: recipientKey,
          message: message.trim() || 'File attachment',
          imageFile: file || undefined,
        });
        showNotification('Message and/or file uploaded to IPFS', 'info');
      } else {
        const encrypted = await encryptMessage('Empty message', 'chat-secret');
        ipfsUrl = await uploadEncryptedJson(encrypted);
      }

      showNotification('Sending on-chain...', 'info');
      await sendMessage(provider, recipient, publicKey, ipfsUrl);
      showNotification('Message sent!', 'success');
      setIsSending(false);
      setMessage('');
      setFile(null);
      setSelectedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadMessages();
    } catch (err) {
      console.error('Send failed:', err);
      showNotification('Failed to send message', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const loadMessages = async () => {
    if (!publicKey || !provider || !recipientKey.trim()) return;
    try {
      let recipient;
      try {
        recipient = new PublicKey(recipientKey);
      } catch {
        showNotification('Invalid recipient wallet address', 'error');
        showNotification(
          'To see your messages dynamically, tell your friend to init your wallet address too, on their side.',
          'info'
        );
        return;
      }
      const passphrase = 'chat-secret';
      const sentMessages = await fetchMessages(provider, publicKey, recipient);
      const decryptedSent = await Promise.all(
        sentMessages.map(async ({ ipfsHash, timestamp }) => {
          try {
            let ipfsUrl = ipfsHash;
            if (ipfsUrl.startsWith('ipfs://')) {
              ipfsUrl = ipfsUrl.replace('ipfs://', '');
            }
            let messageData;
            try {
              const response = await fetch(`https://ipfs.io/ipfs/${ipfsUrl}`);
              if (!response.ok) throw new Error(`IPFS fetch failed: ${response.statusText}`);
              messageData = await response.json();
            } catch (e) {
              console.error('IPFS fetch error:', e);
              return { text: '[Failed to fetch message]', isSender: true, timestamp };
            }
            if (messageData.nonce && messageData.content) {
              const plainText = await decryptMessage(messageData, passphrase);
              return { text: plainText, isSender: true, timestamp };
            } else if (messageData.message) {
              return {
                text: messageData.message,
                isSender: true,
                timestamp,
                image: messageData.image ? `https://ipfs.io/ipfs/${messageData.image}` : undefined,
              };
            } else {
              console.error('Invalid message format for sent message:', messageData);
              return { text: '[Invalid message format]', isSender: true, timestamp };
            }
          } catch (e) {
            console.error('Sent message processing error:', e);
            return { text: '[Processing Failed]', isSender: true, timestamp };
          }
        }).filter(Boolean)
      );
      const receivedMessages = await fetchReceiverMessages(provider, publicKey, recipient);
      const decryptedReceived = await Promise.all(
        receivedMessages.map(async ({ ipfsHash, timestamp }) => {
          try {
            let ipfsUrl = ipfsHash;
            if (ipfsUrl.startsWith('ipfs://')) {
              ipfsUrl = ipfsUrl.replace('ipfs://', '');
            }
            let messageData;
            try {
              const response = await fetch(`https://ipfs.io/ipfs/${ipfsUrl}`);
              if (!response.ok) throw new Error(`IPFS fetch failed: ${response.statusText}`);
              messageData = await response.json();
            } catch (e) {
              console.error('IPFS fetch error:', e);
              return { text: '[Failed to fetch message]', isSender: false, timestamp };
            }
            if (messageData.nonce && messageData.content) {
              const plainText = await decryptMessage(messageData, passphrase);
              return { text: plainText, isSender: false, timestamp };
            } else if (messageData.message) {
              return {
                text: messageData.message,
                isSender: false,
                timestamp,
                image: messageData.image ? `https://ipfs.io/ipfs/${messageData.image}` : undefined,
              };
            } else {
              console.error('Invalid message format for received message:', messageData);
              return { text: '[("""Invalid message format]', isSender: false, timestamp };
            }
          } catch (e) {
            console.error('Received message processing error:', e);
            return { text: '[Processing Failed]', isSender: false, timestamp };
          }
        }).filter(Boolean)
      );
      const allMessages = [...decryptedSent, ...decryptedReceived].sort((a, b) =>
        a.timestamp.cmp(b.timestamp)
      );
      setMessages(allMessages);
    } catch (err) {
      console.error('Failed to load messages:', err);
      showNotification('Failed to load messages', 'error');
      showNotification(
        'To see your messages dynamically, tell your friend to init your wallet address too, on their side.',
        'info'
      );
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when publicKey or recipientKey changes
  useEffect(() => {
    if (publicKey && recipientKey.trim()) {
      loadMessages();
    }
  }, [publicKey, recipientKey]);

  // Handle receiver selection
  const handleSelectReceiver = (receiverWallet: string) => {
    setRecipientKey(receiverWallet);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e);
    if (e.target.files) {
      setSelectedFileName(e.target.files[0].name);
    } else {
      setSelectedFileName('');
    }
  };

  const clearFileSelection = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSelectedFileName('');
    setFile(null);
  };

  // File download handler
  const mimeToExtension = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
    'application/zip': '.zip',
  };

  const handleDownload = async (ipfsUrl: string, defaultFilename = 'attachment') => {
    try {
      const response = await fetch(ipfsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file from IPFS: ${response.statusText}`);
      }
      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      let extension = mimeToExtension[contentType as keyof typeof mimeToExtension] || '';
      let filename = defaultFilename;
      const urlParts = ipfsUrl.split('/');
      const filenameFromUrl = urlParts[urlParts.length - 1];
      const extensionMatch = filenameFromUrl.match(/\.([0-9a-z]+)(?:[?#]|$)/i);
      if (extensionMatch) {
        extension = `.${extensionMatch[1]}`;
        filename = filenameFromUrl.split('.')[0];
      } else if (!extension) {
        extension = contentType.includes('image') ? '.jpg' : contentType.includes('pdf') ? '.pdf' : '';
      }
      const finalFilename = `${filename}${extension || ''}`;
      saveAs(blob, finalFilename);
    } catch (error) {
      console.error('Download failed:', error);
      showNotification('Failed to download the file', 'error');
    }
  };

  // Sparkle effect
  const createSparkle = (x: number, y: number) => {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    document.body.appendChild(sparkle);

    setTimeout(() => {
      sparkle.remove();
    }, 1200);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      createSparkle(e.clientX, e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen text-[#0a1930] font-mono bg-gradient-to-br from-[#e6e9ef] to-[#f0f4f8] relative overflow-hidden scroll-smooth">
      <style>{`
        .sparkle {
          position: fixed;
          width: 8px;
          height: 8px;
          background: radial-gradient(circle, rgb(21, 89, 237), rgb(169, 229, 255));
          border-radius: 50%;
          pointer-events: none;
          opacity: 0.8;
          z-index: 9999;
          animation: sparkle-fade 1.2s ease-out forwards;
        }
        @keyframes sparkle-fade {
          0% {
            transform: scale(1.8);
            opacity: 1;
            filter: drop-shadow(0 0 6px #8ab4f8);
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: scale(0.4);
            opacity: 0;
            filter: none;
          }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
  
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-3 w-full max-w-xs sm:max-w-sm md:max-w-md">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            message={notification.message}
            type={notification.type}
            onClose={() =>
              setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
            }
          />
        ))}
      </div>
  
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%230a1930%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30v4h-4v2h4v4h2v-4h4V8h-4V4h-2zm-12 8h-2v4h-4v2h4v4h2v-4h4v-2h-4v-4zm-6 22h4v-4h2v4h4v2h-4v4h-2v-4H8v-2h4v-4z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] bg-repeat z-0" />
  
      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 sm:p-8 overflow-y-auto max-h-[90vh] border border-[#e6e9ef] animate-slide-in relative">
            <button
              onClick={toggleInstructions}
              className="absolute top-4 right-4 text-2xl text-[#0a1930] hover:text-red-500 font-bold cursor-pointer"
              aria-label="Close instructions"
            >
              ×
            </button>
            <div className="flex items-center gap-2 mb-6">
              <Info className="w-5 h-5 text-[#102841]" />
              <h2 className="text-xl font-semibold text-[#0a1930]">Instructions</h2>
            </div>
            <Instructions />
          </div>
        </div>
      )}
  
      {/* Main Layout */}
      <div className="relative z-10 flex flex-col md:flex-row h-screen pt-20 md:pt-0">
        {/* Sidebar */}
        <aside className="w-full md:w-[300px] bg-white/80 border-r border-[#dce3ed] p-4 sm:p-6 overflow-y-auto shadow-lg backdrop-blur-md transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold flex items-center gap-3 text-[#0a1930]">
              <Users className="w-6 h-6 text-[#102841]" /> Chats
            </h2>
            <button
              onClick={toggleInstructions}
              className="p-2 rounded-full bg-[#e6e9ef]/70 hover:bg-[#d5dce5] transition-all shadow-sm cursor-pointer hover:shadow-md"
              title="Instructions"
            >
              <Info className="w-5 h-5 text-[#0a1930]" />
            </button>
          </div>
          <InitUserProfilePage onSelectReceiver={handleSelectReceiver} />
        </aside>
  
        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col bg-white/80 backdrop-blur-md shadow-inner">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-[#e6e9ef]/50 flex justify-between items-center bg-white/90 shadow-sm">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-3 text-[#0a1930] tracking-wider">
              ▂▃▅▇█▓▒░𝙳𝚎𝙲𝚑𝚊𝚝░▒▓█▇▅▃▂
            </h1>
            <div className="flex items-center gap-3">
              <img src={logo.src} alt="Logo" className="w-8 h-8 sm:w-10 sm:h-10" />
              <WalletMultiButton className="!bg-gradient-to-br !from-[#0a1930] !to-[#102841] hover:!from-[#102841] hover:!to-[#1a3557] !text-white !rounded-xl !px-4 sm:!px-6 !py-2 sm:!py-3 transition-all transform hover:scale-105 !shadow-md" />
            </div>
          </div>
  
          {/* Recipient */}
          <div className="px-4 sm:px-6 py-3 border-b border-[#e6e9ef]/50">
            <p className="w-full bg-gradient-to-r from-[#f0f4f8]/80 to-[#e6e9ef]/80 text-[#0a1930] border border-[#e6e9ef]/50 rounded-xl px-4 py-2 sm:py-3 shadow-sm truncate font-medium text-sm transition-all hover:shadow-md">
              {recipientKey || 'Select a recipient to start chatting'}
            </p>
          </div>
  
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in">
            {messages.length === 0 ? (
              <p className="text-center text-gray-500 opacity-60 text-base sm:text-lg font-medium">
                No messages yet. Start chatting!
              </p>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.isSender ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] sm:max-w-[70%] md:max-w-[60%] px-5 py-3 rounded-2xl shadow-md text-sm transition-all duration-200 ${msg.isSender ? 'bg-gradient-to-br from-[#0a1930] to-[#102841] text-white' : 'bg-gradient-to-r from-[#f0f4f8] to-[#e6e9ef] text-[#0a1930]'}`}>
                    {msg.image && (
                      <div className="mb-3 relative group">
                        {msg.image.match(/\.(jpeg|jpg|png|gif)$/i) ? null : (
                          <div className="flex items-center gap-3 bg-[#f0f4f8]/50 p-3 rounded-xl">
                            <FileText className="w-6 h-6 text-[#102841]" />
                            <span className="text-sm font-medium truncate">
                              {msg.image.split('/').pop() || 'Document'}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => msg.image && handleDownload(msg.image, `attachment-${idx}`)}
                          className="absolute top-3 right-3 bg-gradient-to-br from-white/90 to-[#f0f4f8]/90 p-2 rounded-full opacity-0 group-hover:opacity-100 shadow-md transition-all cursor-pointer"
                          title="Download"
                          aria-label="Download attachment"
                        >
                          <ArrowDownToLine className="w-5 h-5 text-[#0a1930]" />
                        </button>
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{msg.text}</pre>
                    <div className="text-xs text-right mt-2 opacity-80 font-medium">
                      {new Date(msg.timestamp.toNumber() * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
  
          {/* Input Section */}
          <div className="flex flex-wrap gap-3 items-center px-4 sm:px-6 py-4 border-t border-[#e6e9ef]/50 bg-gradient-to-t from-white/95 to-[#f0f4f8]/95 shadow-inner">
            <div className="relative group">
              <button
                type="button"
                onClick={triggerFileInput}
                className="p-2 sm:p-3 text-[#0a1930] hover:text-[#102841] rounded-full hover:bg-[#e6e9ef]/50 transition-all"
                title="Attach file"
              >
                <Paperclip size={22} />
              </button>
              {selectedFileName && (
                <span className="absolute -top-10 left-0 bg-gradient-to-r from-[#f0f4f8] to-[#e6e9ef] text-[#0a1930] text-xs sm:text-sm px-3 py-1 rounded-lg shadow-md max-w-[200px] truncate flex items-center gap-2 font-semibold">
                  {selectedFileName}
                  <button
                    type="button"
                    onClick={clearFileSelection}
                    className="text-[#0a1930] hover:text-[#102841] font-bold cursor-pointer text-xl leading-none"
                    aria-label="Clear selected file"
                  >
                    ×
                  </button>
                </span>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileChange}
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
              />
            </div>
  
            <input
              type="text"
              placeholder="Type your message..."
              className="flex-1 min-w-[200px] bg-[#f8fafc] text-[#0a1930] placeholder-gray-400 border border-[#dce3ed] rounded-xl px-4 py-2 focus:ring-2 focus:ring-[#102841] outline-none shadow-sm transition-all text-sm font-medium"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isSending && handleSend()}
            />
  
            <button
              onClick={handleSend}
              disabled={isSending}
              className="flex items-center gap-2 bg-[#0a1930] hover:bg-[#102841] text-white px-5 py-2 sm:py-3 rounded-xl shadow-md transition-transform transform hover:scale-105 disabled:opacity-50"
            >
              {isSending ? (
                <Loader className="animate-spin w-5 h-5" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span className="text-sm font-semibold">Send</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
  
}