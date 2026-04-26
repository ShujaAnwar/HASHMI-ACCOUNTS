import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jfcfzicifqhlnshckwuk.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pD_Kdsbmu8EtVDp62sBIAw_flYxFIlP';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'tlp-sb-auth-token', // Custom key to avoid collisions
  }
});

// Global suppression for MetaMask/Web3 connection errors which are 
// irrelevant to this application's core functionality.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && (
      event.reason.message?.includes('MetaMask') || 
      event.reason.message?.includes('ethereum') ||
      event.reason.message?.includes('provider')
    )) {
      console.warn("Intercepted and suppressed irrelevant Web3/MetaMask error:", event.reason.message);
      event.preventDefault();
    }
  });
}
