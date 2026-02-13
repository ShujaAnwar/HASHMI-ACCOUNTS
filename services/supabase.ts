import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.45.1';

const supabaseUrl = 'https://jfcfzicifqhlnshckwuk.supabase.co';
const supabaseKey = 'sb_publishable_pD_Kdsbmu8EtVDp62sBIAw_flYxFIlP';

export const supabase = createClient(supabaseUrl, supabaseKey);
