import {
  encryptRoomKeyForUser,
  generateRoomKey,
  generateSalt,
  wrapKeyForUser,
} from '../crypto/keys'
import { formatEncryptedField, hashPassword } from '../auth/login'
import type { UsersFile } from '../types'

export async function buildInitialUsersFile(
  adminUsername: string,
  adminPassword: string,
  apiToken: string,
): Promise<UsersFile> {
  const salt = generateSalt()
  const passwordHash = await hashPassword(adminPassword)
  const roomKey = await generateRoomKey()

  const encryptedApiToken = await wrapKeyForUser(apiToken, adminPassword, salt)
  const encryptedRoomKey = await encryptRoomKeyForUser(roomKey, adminPassword, salt)

  return {
    users: [
      {
        username: adminUsername.trim(),
        passwordHash,
        salt,
        role: 'admin',
        encryptedApiToken: formatEncryptedField(
          encryptedApiToken.ciphertext,
          encryptedApiToken.iv,
        ),
        encryptedRoomKey: formatEncryptedField(
          encryptedRoomKey.ciphertext,
          encryptedRoomKey.iv,
        ),
      },
    ],
  }
}
