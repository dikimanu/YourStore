"use client";

import React, { useState, useEffect } from "react";

export function ApiWakingBanner() {
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;

    // Ping the health endpoint
    const checkApi = async () => {
      // If the API hasn't responded within 2 seconds, show the friendly waking up message
      timeoutId = setTimeout(() => {
        if (isMounted) setIsWaking(true);
      }, 2000);

      try {
        await fetch("/api/health");
      } catch {
        // Ignored, will be handled when server responds
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (isMounted) setIsWaking(false);
      }
    };

    void checkApi();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  if (!isWaking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm px-4 py-2.5 text-center flex items-center justify-center gap-2"
    >
      <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      <span>
        ☕ <strong>Starting up backend services:</strong> Free cloud tiers may take ~30 seconds to wake from sleep. Thank you for your patience!
      </span>
    </div>
  );
}
