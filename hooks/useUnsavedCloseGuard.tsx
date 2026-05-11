'use client'

import { useUnsavedActionGuard } from '@/hooks/useUnsavedActionGuard'

/** Shared unsaved prompt for modals (same copy as WorkDrawer). */
export function useUnsavedCloseGuard({
  isDirty,
  onClose,
  performSave,
}: {
  isDirty: boolean
  onClose: () => void
  performSave: () => Promise<boolean>
}) {
  const { attemptAction: attemptClose, unsavedDialog } = useUnsavedActionGuard({
    isDirty,
    onProceed: onClose,
    performSave,
  })
  return { attemptClose, unsavedDialog }
}
