/**
 * Medcare — Network Status Hook
 *
 * Detects online/offline transitions and provides a banner
 * component to notify users when they lose connectivity.
 *
 * Usage:
 *   const { isOnline, OfflineBanner } = useNetworkStatus();
 *   return (
 *     <>
 *       <OfflineBanner />
 *       {children}
 *     </>
 *   );
 */

import { useState, useEffect } from 'react';

const useNetworkStatus = () => {
  const [isOnline,      setIsOnline]      = useState(navigator.onLine);
  const [wasOffline,    setWasOffline]    = useState(false);
  const [showReconnect, setShowReconnect] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnect(true);
        setTimeout(() => setShowReconnect(false), 4000);
      }
      setWasOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  const OfflineBanner = () => {
    if (isOnline && !showReconnect) return null;
    return (
      <div
        className={`fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all duration-500 ${
          isOnline
            ? 'bg-secondary-600 text-white'
            : 'bg-gray-900 text-white'
        }`}
        role="alert"
        aria-live="polite"
      >
        {isOnline ? (
          <>
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Back online — reconnected
          </>
        ) : (
          <>
            <span className="w-2 h-2 bg-red-400 rounded-full" />
            No internet connection — some features may be unavailable
          </>
        )}
      </div>
    );
  };

  return { isOnline, OfflineBanner };
};

export default useNetworkStatus;
