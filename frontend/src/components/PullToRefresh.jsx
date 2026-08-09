import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

const PullToRefresh = ({ children, onRefresh }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const MAX_PULL_DISTANCE = 120;
  const REFRESH_THRESHOLD = 80;

  useEffect(() => {
    // We only want to enable pull-to-refresh if we are at the very top of the page
    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!isPulling.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      // Only pull down
      if (diff > 0 && window.scrollY === 0) {
        // Prevent default scrolling behavior when pulling
        if (e.cancelable) e.preventDefault();
        
        // Add resistance/friction to the pull
        const pull = Math.min(diff * 0.4, MAX_PULL_DISTANCE);
        setPullDistance(pull);
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling.current) return;
      isPulling.current = false;

      if (pullDistance >= REFRESH_THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(REFRESH_THRESHOLD); // Hold it at threshold while refreshing
        
        // Call refresh function
        if (onRefresh) {
          onRefresh().finally(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          });
        } else {
          // Default reload if no function provided
          setTimeout(() => {
            window.location.reload(true);
          }, 500);
        }
      } else {
        // Snap back
        setPullDistance(0);
      }
    };

    // Use passive: false for touchmove to allow e.preventDefault()
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div className="relative w-full h-full min-h-[100dvh] bg-app">
      {/* Pull indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center items-center overflow-hidden z-0"
        style={{ 
          height: `${pullDistance}px`, 
          transition: isPulling.current ? 'none' : 'height 0.3s ease-out' 
        }}
      >
        <div 
          className="flex items-center justify-center w-10 h-10 rounded-full bg-surface shadow-md text-primary"
          style={{
            transform: `rotate(${pullDistance * 3}deg) scale(${Math.min(pullDistance / 40, 1)})`,
            opacity: Math.min(pullDistance / 60, 1),
            transition: isPulling.current ? 'none' : 'all 0.3s ease-out'
          }}
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      </div>

      {/* Content wrapper that slides down */}
      <div 
        className="relative z-10 w-full h-full bg-app"
        style={{ 
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling.current ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
