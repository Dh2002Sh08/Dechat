'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { initChat, initUserProfile, nickName, fetchNicknameAndReceiverAddress, PROGRAM_ID } from '@/utils/useprogram';
import { AnchorProvider } from '@project-serum/anchor';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { toast, ToastContainer } from 'react-toastify';
import { PencilIcon } from '@heroicons/react/24/outline';

interface InitUserProfilePageProps {
  onSelectReceiver: (receiverWallet: string) => void;
}

export default function InitUserProfilePage({ onSelectReceiver }: InitUserProfilePageProps) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  // const [nickname, setNickname] = useState('');
  const [targetWallet, setTargetWallet] = useState('');
  const [newReceiverWallet, setNewReceiverWallet] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [isProfileInitialized, setIsProfileInitialized] = useState(false);
  const [isChatInitialized, setIsChatInitialized] = useState(false);
  // const [isInitializing, setIsInitializing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [chatContacts, setChatContacts] = useState<{ nickname: string; wallet: string }[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddWalletModalOpen, setIsAddWalletModalOpen] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editWallet, setEditWallet] = useState('');
  const [buttonLoading, setButtonLoading] = useState({ initProfile: false, initChat: false, saveNickname: false, addWallet: false });

  const provider = useMemo(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    return new AnchorProvider(
      connection,
      { publicKey, signTransaction, signAllTransactions },
      { commitment: 'processed' }
    );
  }, [connection, publicKey, signTransaction, signAllTransactions]);

  // Check if account exists
  const checkAccountExists = useCallback(async (publicKey: string) => {
    try {
      const accountInfo = await connection.getAccountInfo(new PublicKey(publicKey));
      return !!accountInfo;
    } catch {
      return false;
    }
  }, [connection]);

  // Check profile initialization and fetch nicknames
  const checkProfile = useCallback(async () => {
    if (!provider || !publicKey) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Directly check profile PDA to ensure accurate initialization status
      const [profilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('profile'), publicKey.toBuffer()],
        PROGRAM_ID
      );
      const accountInfo = await connection.getAccountInfo(profilePda);
      if (accountInfo) {
        const nicknames = await fetchNicknameAndReceiverAddress(provider, publicKey);
        setIsProfileInitialized(true);
        setChatContacts(nicknames);
      } else {
        setIsProfileInitialized(false);
        setChatContacts([]);
      }
    } catch (err) {
      console.error('Check profile error:', err);
      setIsProfileInitialized(false);
      setChatContacts([]);
      toast.error('Failed to verify profile status');
    } finally {
      setIsLoading(false);
    }
  }, [provider, publicKey, connection]);

  // Check chat initialization
  const checkChat = useCallback(async () => {
    if (!provider || !publicKey || !targetWallet) {
      setIsChatInitialized(false);
      return;
    }
    try {
      const recipient = new PublicKey(targetWallet);
      const [chatPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('chat'), publicKey.toBuffer(), recipient.toBuffer()],
        PROGRAM_ID
      );
      const accountInfo = await connection.getAccountInfo(chatPda);
      setIsChatInitialized(!!accountInfo);
    } catch {
      setIsChatInitialized(false);
    }
  }, [provider, publicKey, targetWallet, connection]);

  useEffect(() => {
    let mounted = true;
    if (publicKey) {
      setIsLoading(true);
      // Add slight delay to stabilize UI
      const timer = setTimeout(() => {
        if (mounted) {
          checkProfile();
        }
      }, 500);
      return () => {
        clearTimeout(timer);
        mounted = false;
      };
    } else {
      setIsProfileInitialized(false);
      setIsLoading(false);
      setChatContacts([]);
    }
    return () => {
      mounted = false;
    };
  }, [publicKey, checkProfile]);

  useEffect(() => {
    if (targetWallet && isProfileInitialized) {
      checkChat();
      onSelectReceiver(targetWallet);
    }
  }, [targetWallet, isProfileInitialized, checkChat, onSelectReceiver]);

  const handleInitProfile = useCallback(async () => {
    setButtonLoading((prev) => ({ ...prev, initProfile: true }));
    if (!publicKey || !provider) {
      toast.error('Wallet not connected');
      return;
    }

    // setIsInitializing(true);
    try {
      await initUserProfile(provider, publicKey);
      toast.success('Profile initialized!');
      setIsProfileInitialized(true);
      await checkProfile(); // Refresh profile state
    } catch (err) {
      console.error('Init profile error:', err);
      toast.error('Failed to initialize profile');
    } finally {
      // setIsInitializing(false);
    }
  }, [provider, publicKey, checkProfile]);

  const handleSetNickname = useCallback(async (wallet: string, nickname: string) => {
    setButtonLoading((prev) => ({ ...prev, saveNickname: true, addWallet: true }));
    if (!provider || !publicKey || !wallet || !nickname) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const walletKey = new PublicKey(wallet);
      if (!(await checkAccountExists(walletKey.toBase58()))) {
        toast.error('Invalid receiver wallet address');
        return;
      }
      await nickName(provider, publicKey, walletKey, nickname);
      toast.success(`Nickname updated for ${walletKey.toBase58().slice(0, 8)}...`);
      const nicknames = await fetchNicknameAndReceiverAddress(provider, publicKey);
      setChatContacts(nicknames);
      if (wallet === targetWallet) {
        // setNickname(nickname);
      }
      setEditNickname('');
      setEditWallet('');
      setNewReceiverWallet('');
      setNewNickname('');
      setIsEditModalOpen(false);
      setIsAddWalletModalOpen(false);
    } catch (err) {
      console.error('Set nickname error:', err);
      toast.error('Failed to update nickname');
    }
  }, [provider, publicKey, targetWallet, checkAccountExists]);

  const handleInitChat = useCallback(async () => {
    setButtonLoading((prev) => ({ ...prev, initChat: true }));
    if (!provider || !publicKey || !targetWallet) {
      toast.error('Please fill in all fields');
      return;
    }

    // setIsInitializing(true);
    try {
      const recipient = new PublicKey(targetWallet);
      if (!(await checkAccountExists(recipient.toBase58()))) {
        toast.error('Invalid receiver wallet address');
        return;
      }
      await initChat(provider, publicKey, recipient);
      toast.success('Chat initialized!');
      setIsChatInitialized(true);
    } catch (err) {
      console.error('Init chat error:', err);
      toast.error('Failed to initialize chat');
    } finally {
      // setIsInitializing(false);
    }
  }, [provider, publicKey, targetWallet, checkAccountExists]);

  const handleSelectContact = useCallback(
    (contact: { nickname: string; wallet: string }) => {
      setTargetWallet(contact.wallet);
      // setNickname(contact.nickname);
      onSelectReceiver(contact.wallet);
    },
    [onSelectReceiver]
  );

  const openEditModal = (contact: { nickname: string; wallet: string }) => {
    setEditNickname(contact.nickname);
    setEditWallet(contact.wallet);
    setIsEditModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="text-center p-6 text-gray-500 flex items-center justify-center gap-2">
        <ToastContainer />
        <svg className="animate-spin h-5 w-5 text-[#0a1930]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" />
        </svg>
        Loading...
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white via-[#eaf1f9] to-white rounded-lg p-4 shadow-lg font-mono transition-all duration-300">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover theme="light" />
      {!publicKey && (
        <div className="text-center text-gray-500 p-3 italic animate-fade-in">Please connect your wallet</div>
      )}

      {publicKey && !isProfileInitialized && (
        <div className="p-3">
          <button
            className="w-full px-4 py-2 bg-[#0a1930] text-white rounded-lg hover:bg-[#102841] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transform hover:scale-105"
            onClick={handleInitProfile}
            disabled={buttonLoading.initProfile}
          >
            {buttonLoading.initProfile ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" />
                </svg>
                Initializing...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Initialize Profile
              </>
            )}
          </button>
        </div>
      )}

      {publicKey && isProfileInitialized && (
        <>
          <div className="space-y-2 p-3">
            <button
              className="w-full px-4 py-2 bg-[#0a1930] text-white rounded-lg hover:bg-[#102841] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer transform hover:scale-105"
              onClick={() => setIsAddWalletModalOpen(true)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Wallet
            </button>
            <p className="text-xs text-gray-500 italic animate-fade-in">
              Enter a Solana wallet and nickname to start chatting.
            </p>
          </div>

          {chatContacts.length > 0 && (
            <div className="max-h-96 overflow-y-auto rounded-lg">
              {chatContacts.map((contact, index) => (
                <div
                  key={index}
                  className="group p-3 hover:bg-[#f0f4f8] cursor-pointer rounded-lg flex items-center justify-between transition-all duration-200 hover:shadow-sm"
                  onClick={() => handleSelectContact(contact)}
                >
                  <div>
                    <div className="font-semibold text-[#0a1930]">{contact.nickname}</div>
                    <div className="text-sm text-gray-500 truncate max-w-[180px]">
                      {contact.wallet.slice(0, 6)}...{contact.wallet.slice(-4)}
                    </div>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(contact);
                    }}
                    title="Edit Nickname"
                  >
                    <PencilIcon className="h-5 w-5 text-[#0a1930] hover:text-[#102841]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {targetWallet && !isChatInitialized && (
            <div className="p-3">
              <button
                className="w-full px-4 py-2 bg-[#0a1930] text-white rounded-lg hover:bg-[#102841] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transform hover:scale-105"
                onClick={handleInitChat}
                disabled={buttonLoading.initChat}
              >
                {buttonLoading.initChat ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" />
                    </svg>
                    Initializing...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Start Chat
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full border border-[#0a1930] transform scale-100 hover:scale-105 transition-all duration-300">
            <h3 className="text-lg font-semibold text-[#0a1930]">Edit Nickname</h3>
            <input
              type="text"
              className="w-full mt-2 p-2 bg-[#f0f4f8] text-[#0a1930] border border-[#0a1930] rounded-lg focus:ring-2 focus:ring-[#102841] outline-none transition-all duration-200"
              placeholder="Enter nickname"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
            />
            <div className="flex space-x-2 mt-4">
              <button
                className="flex-1 px-4 py-2 bg-[#0a1930] text-white rounded-lg hover:bg-[#102841] transition-all duration-200 cursor-pointer disabled:opacity-50 transform hover:scale-105"
                onClick={() => handleSetNickname(editWallet, editNickname)}
                disabled={buttonLoading.saveNickname || !editNickname}
              >
                {buttonLoading.saveNickname ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white inline-block mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
              <button
                className="flex-1 px-4 py-2 bg-[#f0f4f8] text-[#0a1930] border border-[#0a1930] rounded-lg hover:bg-[#e5e9ef] transition-all duration-200 cursor-pointer transform hover:scale-105"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddWalletModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full border border-[#0a1930] transform scale-100 hover:scale-105 transition-all duration-300">
            <h3 className="text-lg font-semibold text-[#0a1930]">Add Wallet</h3>
            <input
              type="text"
              className="w-full mt-2 p-2 bg-[#f0f4f8] text-[#0a1930] border border-[#0a1930] rounded-lg focus:ring-2 focus:ring-[#102841] outline-none transition-all duration-200"
              placeholder="Receiver Wallet Address"
              value={newReceiverWallet}
              onChange={(e) => setNewReceiverWallet(e.target.value)}
            />
            <input
              type="text"
              className="w-full mt-2 p-2 bg-[#f0f4f8] text-[#0a1930] border border-[#0a1930] rounded-lg focus:ring-2 focus:ring-[#102841] outline-none transition-all duration-200"
              placeholder="Nickname"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
            />
            <div className="flex space-x-2 mt-4">
              <button
                className="flex-1 px-4 py-2 bg-[#0a1930] text-white rounded-lg hover:bg-[#102841] transition-all duration-200 cursor-pointer disabled:opacity-50 transform hover:scale-105"
                onClick={() => handleSetNickname(newReceiverWallet, newNickname)}
                disabled={buttonLoading.addWallet || !newReceiverWallet || !newNickname}
              >
                {buttonLoading.addWallet ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white inline-block mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" />
                    </svg>
                    Adding...
                  </>
                ) : (
                  'Add'
                )}
              </button>
              <button
                className="flex-1 px-4 py-2 bg-[#f0f4f8] text-[#0a1930] border border-[#0a1930] rounded-lg hover:bg-[#e5e9ef] transition-all duration-200 cursor-pointer transform hover:scale-105"
                onClick={() => setIsAddWalletModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
}