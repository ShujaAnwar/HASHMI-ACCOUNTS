import React, { useEffect, useRef } from 'react';
import { AppConfig } from '../types';

interface AutoRefreshManagerProps {
  config: AppConfig;
  onRefresh: () => void;
}

const AutoRefreshManager: React.FC<AutoRefreshManagerProps> = ({ config, onRefresh }) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Only set timer if auto refresh is enabled
    if (config.autoRefreshEnabled && config.autoRefreshIntervalMinutes) {
      const ms = config.autoRefreshIntervalMinutes * 60 * 1000;
      
      console.log(`[AutoRefresh] Initialized cycle: every ${config.autoRefreshIntervalMinutes} minutes.`);
      
      timerRef.current = setInterval(() => {
        console.log('[AutoRefresh] Triggering scheduled data refresh...');
        onRefresh();
      }, ms);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [config.autoRefreshEnabled, config.autoRefreshIntervalMinutes, onRefresh]);

  return null; // Side-effect only component
};

export default AutoRefreshManager;
