import { supabase } from './supabase';
import { HajiMaster } from '../types';

export class HajiService {
  static async getAll() {
    const { data, error } = await supabase
      .from('haji_master')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(row => ({
      id: row.id,
      hajiId: row.haji_id,
      fullName: row.full_name,
      passportNumber: row.passport_number,
      contactNumber: row.contact_number,
      nationality: row.nationality,
      createdAt: row.created_at
    })) as HajiMaster[];
  }

  static async searchByPassport(passport: string) {
    const { data, error } = await supabase
      .from('haji_master')
      .select('*')
      .eq('passport_number', passport.trim().toUpperCase())
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (!data) return null;

    return {
      id: data.id,
      hajiId: data.haji_id,
      fullName: data.full_name,
      passportNumber: data.passport_number,
      contactNumber: data.contact_number,
      nationality: data.nationality,
      createdAt: data.created_at
    } as HajiMaster;
  }

  static async create(haji: Omit<HajiMaster, 'id' | 'hajiId' | 'createdAt'>) {
    // Generate next friendly ID
    const { data: countData } = await supabase
      .from('haji_master')
      .select('haji_id', { count: 'exact' });
    
    const count = (countData?.length || 0) + 1;
    const hajiId = `H-${String(count).padStart(4, '0')}`;

    const { data, error } = await supabase
      .from('haji_master')
      .insert({
        haji_id: hajiId,
        full_name: haji.fullName,
        passport_number: haji.passportNumber.trim().toUpperCase(),
        contact_number: haji.contactNumber,
        nationality: haji.nationality
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async search(query: string): Promise<HajiMaster[]> {
    const { data, error } = await supabase
      .from('haji_master')
      .select('*')
      .or(`full_name.ilike.%${query}%,passport_number.ilike.%${query}%`)
      .limit(10);
    
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      hajiId: row.haji_id,
      fullName: row.full_name,
      passportNumber: row.passport_number,
      contactNumber: row.contact_number,
      nationality: row.nationality,
      createdAt: row.created_at
    })) as HajiMaster[];
  }

  static async getHistory(passportNumber: string) {
    // We search all vouchers where details contain this passport number
    // This is a bit tricky with JSONB but we can search for the string
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .filter('details', 'cs', `{"passportNumber": "${passportNumber}"}`); // This might not catch all items in array

    // Better approach: Since vouchers.details.items often contain the passport
    // We might need a more specialized query or handle it in JS for now if data isn't huge
    // For now, let's fetch all relevant vouchers and filter in memory if needed
    // or use a broader search
    
    const { data: allVouchers, error: vErr } = await supabase
      .from('vouchers')
      .select('*')
      .order('date', { ascending: false });

    if (vErr) throw vErr;

    return (allVouchers || []).filter(v => {
      const detailsStr = JSON.stringify(v.details || {}).toUpperCase();
      return detailsStr.includes(passportNumber.toUpperCase());
    });
  }
}
