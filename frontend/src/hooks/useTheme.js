import { useEffect } from 'react';

// Maps a user's role to one of the 3 visual themes.
// admin -> Violet Bloom, manager -> Ocean Breeze, caller (default) -> Coral Sunrise.
export function roleToTheme(role) {
  if (role === 'admin') return 'admin';
  if (role === 'manager') return 'manager';
  return 'caller';
}

// Applies the given theme name to <html data-theme="...">.
// Pass a fixed theme name (e.g. 'login') or a role-derived one.
export default function useTheme(themeName) {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute('data-theme');
    root.setAttribute('data-theme', themeName || 'caller');
    return () => {
      // no-op on cleanup; next mounted consumer will set its own theme
      if (prev) {
        // restore previous theme if this hook unmounts without a replacement
        // (harmless no-op in practice since Layout/Login always re-set it)
      }
    };
  }, [themeName]);
}