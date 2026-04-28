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
    if (!haji.fullName) throw new Error("Haji Full Name is required");
    
    // Generate next friendly ID
    const { data: countData } = await supabase
      .from('haji_master')
      .select('haji_id');
    
    const count = (countData?.length || 0) + 1;
    const hajiId = `H-${String(count).padStart(4, '0')}`;

    const { data, error } = await supabase
      .from('haji_master')
      .insert({
        haji_id: hajiId,
        full_name: haji.fullName,
        passport_number: haji.passportNumber ? haji.passportNumber.trim().toUpperCase() : null,
        contact_number: haji.contactNumber || null,
        nationality: haji.nationality || null
      })
      .select()
      .single();
    
    if (error) throw error;
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

  static async ensureHaji(haji: { fullName: string; passportNumber?: string; nationality?: string; contactNumber?: string }) {
    if (!haji.fullName) return null;

    // 1. Try to find by passport if provided
    if (haji.passportNumber) {
      const existing = await this.searchByPassport(haji.passportNumber);
      if (existing) return existing;
    }

    // 2. Try to find by name (similarity)
    const { data: nameMatches } = await supabase
      .from('haji_master')
      .select('*')
      .ilike('full_name', haji.fullName)
      .limit(1);
    
    if (nameMatches && nameMatches.length > 0) {
      const match = nameMatches[0];
      return {
        id: match.id,
        hajiId: match.haji_id,
        fullName: match.full_name,
        passportNumber: match.passport_number,
        contactNumber: match.contact_number,
        nationality: match.nationality,
        createdAt: match.created_at
      } as HajiMaster;
    }

    // 3. Not found, create new
    return await this.create({
      fullName: haji.fullName,
      passportNumber: haji.passportNumber || undefined,
      nationality: haji.nationality || undefined,
      contactNumber: haji.contactNumber || undefined
    });
  }

  static async update(id: string, haji: Partial<Omit<HajiMaster, 'id' | 'hajiId' | 'createdAt'>>) {
    const { data, error } = await supabase
      .from('haji_master')
      .update({
        full_name: haji.fullName,
        passport_number: haji.passportNumber ? haji.passportNumber.trim().toUpperCase() : undefined,
        contact_number: haji.contactNumber,
        nationality: haji.nationality
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
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

  static async delete(id: string) {
    const { error } = await supabase
      .from('haji_master')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
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

  static async getHistory(params: { hajiId?: string; passportNumber?: string; fullName?: string }) {
    const { hajiId, passportNumber, fullName } = params;
    
    // Fetch all vouchers to filter in memory for complex JSONB search
    // In production, we'd use better JSONB indexing or separate relation tables
    const { data: allVouchers, error: vErr } = await supabase
      .from('vouchers')
      .select('*')
      .order('date', { ascending: false });

    if (vErr) throw vErr;

    return (allVouchers || []).filter(v => {
      const details = v.details || {};
      const detailsStr = JSON.stringify(details).toUpperCase();
      
      // 1. Check if direct details/items have the hajiId
      if (hajiId && (details.hajiId === hajiId || detailsStr.includes(hajiId.toUpperCase()))) return true;
      
      // 2. Check passport
      if (passportNumber && detailsStr.includes(passportNumber.trim().toUpperCase())) return true;
      
      // 3. Check name
      if (fullName && detailsStr.includes(fullName.trim().toUpperCase())) return true;

      return false;
    });
  }
}
