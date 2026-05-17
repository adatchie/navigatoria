export function isQuestDeadlineNotice(message?: string | null): boolean {
  return Boolean(message && message.includes('期限切れ'))
}
