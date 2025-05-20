use anchor_lang::prelude::*;

declare_id!("7cKXCHc1T8Tk6TPrMVwd8dgqqek3G1kuBLnHFhBhHkUU");

const MAX_MESSAGES: usize = 80;
const MAX_IPFS_HASH_LENGTH: usize = 64;
const MAX_NICKNAME_LENGTH: usize = 32;

const MESSAGE_ENTRY_SIZE: usize = 32 + 8 + 4 + MAX_IPFS_HASH_LENGTH;
const CHAT_ACCOUNT_SIZE: usize = 8 + (32 * 2) + 4 + (MAX_MESSAGES * MESSAGE_ENTRY_SIZE) + 1;
const USER_PROFILE_SIZE: usize =
    8 + 32 + 4 + (50 * (32 + 4 + MAX_NICKNAME_LENGTH)) + 4 + (50 * 32) + 1;

#[program]
pub mod chat {
    use super::*;

    pub fn init_chat(ctx: Context<InitChat>) -> Result<()> {
        let chat_account = &mut ctx.accounts.chat_account;
        chat_account.participants = [ctx.accounts.sender.key(), ctx.accounts.receiver.key()];
        chat_account.messages = Vec::new();
        chat_account.bump = ctx.bumps.chat_account;

        let profile = &mut ctx.accounts.user_profile;

        if !profile.history.contains(&ctx.accounts.receiver.key()) {
            profile.history.push(ctx.accounts.receiver.key());
        }

        Ok(())
    }

    pub fn send_message(ctx: Context<SendMessage>, ipfs_hash: String) -> Result<()> {
        require!(
            ipfs_hash.len() <= MAX_IPFS_HASH_LENGTH,
            ChatError::HashTooLong
        );

        let chat_account = &mut ctx.accounts.chat_account;
        let sender = &ctx.accounts.sender;

        require!(
            sender.key() == chat_account.participants[0]
                || sender.key() == chat_account.participants[1],
            ChatError::Unauthorized
        );

        let clock = Clock::get()?;

        let message = MessageEntry {
            sender: sender.key(),
            ipfs_hash,
            timestamp: clock.unix_timestamp,
        };

        if chat_account.messages.len() >= MAX_MESSAGES {
            chat_account.messages.remove(0);
        }

        chat_account.messages.push(message);
        Ok(())
    }

    pub fn init_user_profile(ctx: Context<InitUserProfile>) -> Result<()> {
        let profile = &mut ctx.accounts.user_profile;
        profile.wallet = ctx.accounts.authority.key();
        profile.nicknames = Vec::new();
        profile.history = Vec::new();
        profile.bump = ctx.bumps.user_profile;
        Ok(())
    }

    pub fn set_nickname(ctx: Context<SetNickname>, wallet: Pubkey, nickname: String) -> Result<()> {
        require!(
            nickname.len() <= MAX_NICKNAME_LENGTH,
            ChatError::NicknameTooLong
        );

        let profile = &mut ctx.accounts.user_profile;

        match profile
            .nicknames
            .iter_mut()
            .find(|entry| entry.wallet == wallet)
        {
            Some(entry) => entry.nickname = nickname,
            None => profile.nicknames.push(NicknameEntry { wallet, nickname }),
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitChat<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: PDA only
    pub receiver: AccountInfo<'info>,

    #[account(
        init,
        payer = sender,
        space = CHAT_ACCOUNT_SIZE,
        seeds = [b"chat", sender.key().as_ref(), receiver.key().as_ref()],
        bump
    )]
    pub chat_account: Account<'info, ChatAccount>,

    #[account(
        mut,
        seeds = [b"profile", sender.key().as_ref()],
        bump = user_profile.bump
    )]
    pub user_profile: Account<'info, UserProfile>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(ipfs_hash: String)]
pub struct SendMessage<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK:
    pub receiver: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"chat", sender.key().as_ref(), receiver.key().as_ref()],
        bump = chat_account.bump
    )]
    pub chat_account: Account<'info, ChatAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitUserProfile<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = USER_PROFILE_SIZE,
        seeds = [b"profile", authority.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetNickname<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"profile", authority.key().as_ref()],
        bump = user_profile.bump
    )]
    pub user_profile: Account<'info, UserProfile>,
}

#[account]
pub struct ChatAccount {
    pub participants: [Pubkey; 2],
    pub messages: Vec<MessageEntry>,
    pub bump: u8,
}

#[account]
pub struct UserProfile {
    pub wallet: Pubkey,
    pub nicknames: Vec<NicknameEntry>,
    pub history: Vec<Pubkey>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct NicknameEntry {
    pub wallet: Pubkey,
    pub nickname: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MessageEntry {
    pub sender: Pubkey,
    pub ipfs_hash: String,
    pub timestamp: i64,
}

#[error_code]
pub enum ChatError {
    #[msg("IPFS hash is too long.")]
    HashTooLong,
    #[msg("Nickname is too long.")]
    NicknameTooLong,
    #[msg("Unauthorized access to chat.")]
    Unauthorized,
}
