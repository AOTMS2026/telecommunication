import { useState, useEffect } from 'react';

export const BREAKPOINTS = { mobile: 640, tablet: 1024 };

function computeBP() {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < BREAKPOINTS.mobile) return 'mobile';
  if (w < BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
}

// Returns 'mobile' | 'tablet' | 'desktop' and updates live on resize.
export default function useBreakpoint() {
  const [bp, setBp] = useState(computeBP);

  useEffect(() => {
    let frame;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setBp(computeBP()));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
    };
  }, []);

  return bp;
}

export function useIsMobile() {
  return useBreakpoint() === 'mobile';
}