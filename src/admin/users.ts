import {
  encryptRoomKeyForUser,
  generateSalt,
  wrapKeyForUser,
} from '../crypto/keys'
import { formatEncryptedField, hashPassword } from '../auth/login'
import { readUsersFile, writeFileWithRetry } from '../storage'
import type { Session, UserRecord, UsersFile } from '../types'

export interface AddUserInput {
  username: string
  password: string
}

export async function listUsers(session: Session): Promise<UserRecord[]> {
  const result = await readUsersFile(session.apiToken)
  return result?.data.users ?? []
}

export async function addUser(
  session: Session,
  input: AddUserInput,
  roomKey: CryptoKey,
): Promise<void> {
  if (session.role !== 'admin') {
    throw new Error('Only admins can add users.')
  }

  const username = input.username.trim()
  if (!username) {
    throw new Error('Username is required.')
  }
  if (input.password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }

  const salt = generateSalt()
  const passwordHash = await hashPassword(input.password)

  const encryptedApiToken = await wrapKeyForUser(
    session.apiToken,
    input.password,
    salt,
  )
  const encryptedRoomKey = await encryptRoomKeyForUser(
    roomKey,
    input.password,
    salt,
  )

  const newUser: UserRecord = {
    username,
    passwordHash,
    salt,
    role: 'user',
    encryptedApiToken: formatEncryptedField(
      encryptedApiToken.ciphertext,
      encryptedApiToken.iv,
    ),
    encryptedRoomKey: formatEncryptedField(
      encryptedRoomKey.ciphertext,
      encryptedRoomKey.iv,
    ),
  }

  await writeFileWithRetry<UsersFile>(
    'data/users.json',
    session.apiToken,
    (current) => {
      const users = current?.users ?? []
      if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
        throw new Error('Username already exists.')
      }
      return { users: [...users, newUser] }
    },
    `Add user ${username}`,
  )
}

export async function removeUser(session: Session, username: string): Promise<void> {
  if (session.role !== 'admin') {
    throw new Error('Only admins can remove users.')
  }

  const target = username.trim()
  if (!target) {
    throw new Error('Username is required.')
  }

  if (target.toLowerCase() === session.username.toLowerCase()) {
    throw new Error('You cannot remove your own account.')
  }

  await writeFileWithRetry<UsersFile>(
    'data/users.json',
    session.apiToken,
    (current) => {
      const users = current?.users ?? []
      const remaining = users.filter(
        (u) => u.username.toLowerCase() !== target.toLowerCase(),
      )

      if (remaining.length === users.length) {
        throw new Error('User not found.')
      }

      if (remaining.length === 0) {
        throw new Error('Cannot remove the last user.')
      }

      const adminCount = remaining.filter((u) => u.role === 'admin').length
      if (adminCount === 0) {
        throw new Error('Cannot remove the last admin.')
      }

      return { users: remaining }
    },
    `Remove user ${target}`,
  )
}
