import { db } from '../db/database'
import type { UserProfile } from '../types/domain'

export const USER_PROFILE_ID = 'user-self'

export async function getOrCreateUserProfile():
Promise<UserProfile> {
  const existingProfile =
    await db.userProfiles.get(USER_PROFILE_ID)

  if (existingProfile) {
    return existingProfile
  }

  const now = new Date().toISOString()

  const defaultProfile: UserProfile = {
    id: USER_PROFILE_ID,
    name: '我',
    avatar: '🧑',
    identity: '',
    bio: '',
    createdAt: now,
    updatedAt: now
  }

  await db.userProfiles.put(defaultProfile)

  return defaultProfile
}