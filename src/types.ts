export type UserRole = 'admin' | 'user'

export interface UserRecord {
  username: string
  passwordHash: string
  salt: string
  role: UserRole
  encryptedApiToken: string
  encryptedRoomKey: string
}

export interface UsersFile {
  users: UserRecord[]
}

export interface StoredMessage {
  id: string
  sender: string
  threadId?: string
  timestamp: number
  ciphertext: string
  iv: string
}

export interface MessagesFile {
  messages: StoredMessage[]
}

export interface RepoConfig {
  owner: string
  repo: string
}

export interface Session {
  username: string
  role: UserRole
  apiToken: string
  roomKey: CryptoKey
}

export interface EncryptedPayload {
  ciphertext: string
  iv: string
}
