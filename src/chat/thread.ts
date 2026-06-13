export function makeThreadId(userA: string, userB: string): string {
  return [userA, userB].map((u) => u.trim().toLowerCase()).sort().join('::')
}

export function isParticipant(threadId: string, username: string): boolean {
  const lower = username.trim().toLowerCase()
  return threadId.split('::').includes(lower)
}

export function otherParticipant(threadId: string, username: string): string | null {
  const lower = username.trim().toLowerCase()
  const parts = threadId.split('::')
  const other = parts.find((p) => p !== lower)
  return other ?? null
}
