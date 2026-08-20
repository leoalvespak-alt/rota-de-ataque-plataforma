export function isPublicationCancellable(status: string): boolean {
  return ['scheduled', 'pending', 'queued'].includes(status)
}

export function isManualConfirmationAllowed(status: string): boolean {
  return ['pending_manual', 'scheduled', 'queued'].includes(status)
}
