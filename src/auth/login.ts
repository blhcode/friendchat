import bcrypt from 'bcryptjs'
import { decryptRoomKeyForUser, unwrapKeyForUser } from '../crypto/keys'
import { readUsersFile } from '../storage'
import { isLocalMode } from '../config'
import type { Session, UserRecord } from '../types'
import { saveSession } from './session'

export async function login(
  readToken: string | undefined,
  username: string,
  password: string,
): Promise<Session> {
  const usersResult = await readUsersFile(readToken)
  if (!usersResult) {
    throw new Error('Chat not set up yet. Check config.json or complete setup.')
  }

  const user = usersResult.data.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  )
  if (!user) {
    throw new Error('Invalid username or password.')
  }

  await verifyPassword(user, password)

  const { ciphertext: tokenCiphertext, iv: tokenIv } = parseEncryptedField(
    user.encryptedApiToken,
  )
  const apiToken = await unwrapKeyForUser(tokenCiphertext, tokenIv, password, user.salt)

  const { ciphertext, iv } = parseEncryptedField(user.encryptedRoomKey)
  const roomKey = await decryptRoomKeyForUser(ciphertext, iv, password, user.salt)

  const session: Session = {
    username: user.username,
    role: user.role,
    apiToken: isLocalMode() ? 'local' : apiToken,
    roomKey,
  }

  await saveSession(session)
  return session
}

async function verifyPassword(user: UserRecord, password: string): Promise<void> {
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw new Error('Invalid username or password.')
  }
}

function parseEncryptedField(value: string): { ciphertext: string; iv: string } {
  return JSON.parse(value) as { ciphertext: string; iv: string }
}

export function formatEncryptedField(ciphertext: string, iv: string): string {
  return JSON.stringify({ ciphertext, iv })
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}
