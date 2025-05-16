import { Idl } from "@project-serum/anchor";

export const programId = '7cKXCHc1T8Tk6TPrMVwd8dgqqek3G1kuBLnHFhBhHkUU';

export const IDL: Idl = {
    "version": "0.1.0",
    "name": "chat",
    "instructions": [
        {
            "name": "initChat",
            "accounts": [
                {
                    "name": "sender",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "receiver",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "chatAccount",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "userProfile",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": []
        },
        {
            "name": "sendMessage",
            "accounts": [
                {
                    "name": "sender",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "receiver",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "chatAccount",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "ipfsHash",
                    "type": "string"
                }
            ]
        },
        {
            "name": "initUserProfile",
            "accounts": [
                {
                    "name": "authority",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "userProfile",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": []
        },
        {
            "name": "setNickname",
            "accounts": [
                {
                    "name": "authority",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "userProfile",
                    "isMut": true,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "wallet",
                    "type": "publicKey"
                },
                {
                    "name": "nickname",
                    "type": "string"
                }
            ]
        }
    ],
    "accounts": [
        {
            "name": "ChatAccount",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "participants",
                        "type": {
                            "array": [
                                "publicKey",
                                2
                            ]
                        }
                    },
                    {
                        "name": "messages",
                        "type": {
                            "vec": {
                                "defined": "MessageEntry"
                            }
                        }
                    },
                    {
                        "name": "bump",
                        "type": "u8"
                    }
                ]
            }
        },
        {
            "name": "UserProfile",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "wallet",
                        "type": "publicKey"
                    },
                    {
                        "name": "nicknames",
                        "type": {
                            "vec": {
                                "defined": "NicknameEntry"
                            }
                        }
                    },
                    {
                        "name": "history",
                        "type": {
                            "vec": "publicKey"
                        }
                    },
                    {
                        "name": "bump",
                        "type": "u8"
                    }
                ]
            }
        }
    ],
    "types": [
        {
            "name": "NicknameEntry",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "wallet",
                        "type": "publicKey"
                    },
                    {
                        "name": "nickname",
                        "type": "string"
                    }
                ]
            }
        },
        {
            "name": "MessageEntry",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "sender",
                        "type": "publicKey"
                    },
                    {
                        "name": "ipfsHash",
                        "type": "string"
                    },
                    {
                        "name": "timestamp",
                        "type": "i64"
                    }
                ]
            }
        }
    ],
    "errors": [
        {
            "code": 6000,
            "name": "HashTooLong",
            "msg": "IPFS hash is too long."
        },
        {
            "code": 6001,
            "name": "NicknameTooLong",
            "msg": "Nickname is too long."
        },
        {
            "code": 6002,
            "name": "Unauthorized",
            "msg": "Unauthorized access to chat."
        }
    ]
}