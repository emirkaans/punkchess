import { useEffect, useState } from 'react';

const PHONE = '(max-width: 760px)';

/** True on a phone-width screen (the layout's own breakpoint), updated as the window resizes. */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof matchMedia === 'function' && matchMedia(PHONE).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(PHONE);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}
