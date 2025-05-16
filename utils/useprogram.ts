import { Program, AnchorProvider, BN } from '@project-serum/anchor'
import { SystemProgram, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js'
import { programId, IDL } from './program'
// import { get } from 'http';


export const PROGRAM_ID = new PublicKey(programId);




export function getProgram(provider: AnchorProvider) {
  return new Program(IDL, PROGRAM_ID, provider)
}
// console.log("Program ID", PROGRAM_ID.toString());
// console.log("IDL instructions:", IDL.instructions);


export async function initChat(
  provider: AnchorProvider,
  sender: PublicKey,
  receiver: PublicKey,
) {
  const program = getProgram(provider);
  const connection = provider.connection;

  const [chatPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('chat'), sender.toBuffer(), receiver.toBuffer()],
    PROGRAM_ID
  );
  console.log('Chat PDA:', chatPda.toString());

  const [profilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('profile'), sender.toBuffer()],
    PROGRAM_ID
  );
  console.log('Profile PDA:', profilePda.toString());



  const transaction = new Transaction();

  // Add priority fee
  const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 10000,
  });
  transaction.add(priorityFeeInstruction);

  // Add initChat instruction
  const instruction = await program.methods
    .initChat()
    .accounts({
      sender,
      receiver,
      chatAccount: chatPda,
      userProfile: profilePda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  transaction.add(instruction);

  // Set recent blockhash and fee payer
  const { blockhash } = await connection.getLatestBlockhash('finalized');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = sender;

  try {
    const signature = await provider.sendAndConfirm(transaction, [], {
      maxRetries: 5,
      commitment: 'confirmed',
    });
    console.log('InitChat Transaction ID:', signature);

    // Verify transaction
    const confirmation = await connection.getSignatureStatus(signature);
    if (confirmation?.value?.err) {
      console.error('InitChat transaction failed:', confirmation.value.err);
      throw new Error(`InitChat transaction failed: ${confirmation.value.err}`);
    }
    console.log('InitChat transaction confirmed:', signature);
    return signature;
  } catch (error: any) {
    console.error('InitChat error:', error);
    if (error.logs) {
      console.error('Program logs:', error.logs);
    }
    throw new Error(`Failed to initialize chat: ${error.message}`);
  }
}

export async function sendMessage(
  provider: AnchorProvider,
  receiver: PublicKey,
  sender: PublicKey,
  ipfsHash: string,
) {
  const program = getProgram(provider);
  const connection = provider.connection;

  const [chatPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('chat'), sender.toBuffer(), receiver.toBuffer()],
    PROGRAM_ID
  );
  console.log('Chat PDA:', chatPda.toString());
  console.log('IPFS Hash:', ipfsHash);

  // Check if chatAccount exists
  const chatAccountInfo = await connection.getAccountInfo(chatPda);
  if (!chatAccountInfo) {
    console.log('Chat account not initialized, calling initChat...');
    await initChat(provider, sender, receiver);
  } else {
    console.log('Chat account exists, proceeding with sendMessage.');
  }

  // Create transaction with priority fee
  const transaction = new Transaction();

  // Add priority fee instruction
  const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 10000, // Adjust based on network conditions
  });
  transaction.add(priorityFeeInstruction);

  // Add sendMessage instruction
  const instruction = await program.methods
    .sendMessage(ipfsHash)
    .accounts({
      chatAccount: chatPda,
      sender,
      receiver,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  transaction.add(instruction);

  // Set recent blockhash and fee payer
  const { blockhash } = await connection.getLatestBlockhash('finalized');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = sender;

  try {
    // Sign and send transaction
    const signature = await provider.sendAndConfirm(transaction, [], {
      maxRetries: 5, // Retry up to 5 times
      commitment: 'confirmed',
    });
    console.log('Transaction ID:', signature);

    // Verify transaction
    const confirmation = await connection.getSignatureStatus(signature);
    if (confirmation?.value?.err) {
      console.error('Transaction failed:', confirmation.value.err);
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }
    console.log('Transaction confirmed:', signature);
    return signature;
  } catch (error: any) {
    console.error('Send message error:', error);
    if (error.logs) {
      console.error('Program logs:', error.logs);
    }
    throw new Error(`Failed to send message: ${error.message}`);
  }
}

export const fetchMessages = async (
  provider: AnchorProvider,
  user: PublicKey,
  recipient: PublicKey
) => {
  const program = getProgram(provider)

  const [chatPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('chat'), user.toBuffer(), recipient.toBuffer()],
    PROGRAM_ID
  )
  console.log("Chat PDA:", chatPda.toString());

  const chatAccount = await program.account.chatAccount.fetch(chatPda);

  // Filter messages where the sender is the user
  const userMessages = (chatAccount.messages as {
    sender: PublicKey;
    ipfsHash: string;
    timestamp: BN;
  }[]).filter((msg) => msg.sender.equals(user));

  return userMessages;
}

export const fetchReceiverMessages = async (
  provider: AnchorProvider,
  user: PublicKey,
  recipient: PublicKey
) => {
  const program = getProgram(provider);

  // Reverse the order: use recipient as the first key
  const [chatPda] = await PublicKey.findProgramAddressSync(
    [Buffer.from('chat'), recipient.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
  console.log("Chat PDA:", chatPda.toString());

  const chatAccount = await program.account.chatAccount.fetch(chatPda);

  // Filter messages where the sender is the recipient
  const receiverMessages = (chatAccount.messages as {
    sender: PublicKey;
    ipfsHash: string;
    timestamp: BN;
  }[]).filter((msg) => msg.sender.equals(recipient));

  return receiverMessages;
};



export function getSortedKeys(a: PublicKey, b: PublicKey): [PublicKey, PublicKey] {
  return a.toBase58() < b.toBase58() ? [a, b] : [b, a]
}

export function getChatPDA(userA: PublicKey, userB: PublicKey): [PublicKey, number] {
  const [key1, key2] = getSortedKeys(userA, userB)
  return PublicKey.findProgramAddressSync(
    [Buffer.from('chat'), key1.toBuffer(), key2.toBuffer()],
    PROGRAM_ID
  );
}

export async function initUserProfile(
  provider: AnchorProvider,
  user: PublicKey,
){
  const program = getProgram(provider);

  const [profilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('profile'), user.toBuffer()],
    PROGRAM_ID
  );

  const tx = await program.methods.initUserProfile()
    .accounts({
      user,
      userProfile: profilePda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log('Transaction ID:', tx);
  const confirmation = await provider.connection.getSignatureStatus(tx);
  if (confirmation?.value?.err) {
    console.error('Transaction failed:', confirmation.value.err);
    throw new Error(`Transaction failed: ${confirmation.value.err}`);
  }
  console.log('Transaction confirmed:', tx);
  return tx;
}

export async function nickName(
  provider: AnchorProvider,
  user: PublicKey,
  wallet: PublicKey,
  nickname: string,
) {
  const program = getProgram(provider);

  const [profilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('profile'), user.toBuffer()],
    PROGRAM_ID
  );

  const tx = await program.methods.setNickname(wallet, nickname)
    .accounts({
      authority: user,
      userProfile: profilePda,
    })
    .rpc();
  console.log('Transaction ID:', tx);
  const confirmation = await provider.connection.getSignatureStatus(tx);
  if (confirmation?.value?.err) {
    console.error('Transaction failed:', confirmation.value.err);
    throw new Error(`Transaction failed: ${confirmation.value.err}`);
  }
  console.log('Transaction confirmed:', tx);
  return tx;
}

export async function fetchNicknameAndReceiverAddress(
  provider: AnchorProvider,
  user: PublicKey
): Promise<{ nickname: string; wallet: string }[]> {
  try {
    const program = getProgram(provider);

    const [profilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('profile'), user.toBuffer()],
      PROGRAM_ID
    );
    console.log('Profile PDA:', profilePda.toString());

    const profileAccount = await program.account.userProfile.fetchNullable(profilePda);
    
    if (!profileAccount) {
      return [];
    }

    // Map the nicknames array to the desired format
    const nicknames = profileAccount.nicknames.map(
      (entry: { wallet: PublicKey; nickname: string }) => ({
        nickname: entry.nickname,
        wallet: entry.wallet.toString(),
      })
    );

    return nicknames;
  } catch (err) {
    console.error('Error fetching nicknames:', err);
    return [];
  }
}