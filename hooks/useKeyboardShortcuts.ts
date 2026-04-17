import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutsOptions {
  onSearchOpen?: () => void;
  enabled?: boolean;
}

/**
 * Hook for managing keyboard shortcuts
 * - Ctrl/Cmd + K: Open search
 * - Escape: Close modals/search
 */
export const useKeyboardShortcuts = ({
  onSearchOpen,
  enabled = true,
}: UseKeyboardShortcutsOptions) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check for Ctrl+K or Cmd+K (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        onSearchOpen?.();
        return;
      }

      // Escape key to close search/modals
      if (event.key === 'Escape') {
        // Let the component handle escape via their own logic
        return;
      }
    },
    [onSearchOpen, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
};
