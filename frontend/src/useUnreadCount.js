// The number of unread messages, for the badge next to "Messages" in the menu.
// Checks again every 30 seconds while the page is open; call refresh() after
// opening a conversation so the badge goes down straight away.

import { useCallback, useEffect, useState } from 'react';

const CHECK_EVERY_MS = 30000;

// load: an api function that returns { count }. enabled: false = always 0.
export default function useUnreadCount(load, enabled = true) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled) return;
    load()
      .then((res) => setCount(res.count))
      .catch(() => {}); // the badge is a hint; the Messages page shows real errors
  }, [load, enabled]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return [enabled ? count : 0, refresh];
}
