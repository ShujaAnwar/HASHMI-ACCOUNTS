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
    
    // Generate next friendly ID by finding the maximum current ID
    const { data: lastHaji } = await supabase
      .from('haji_master')
      .select('haji_id')
      .order('haji_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    let nextNum = 1;
    if (lastHaji?.haji_id) {
      const match = lastHaji.haji_id.match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0]) + 1;
      }
    }
    const hajiId = `H-${String(nextNum).padStart(4, '0')}`;

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

  static mapToHajiMaster(row: any): HajiMaster {
    return {
      id: row.id,
      hajiId: row.haji_id,
      fullName: row.full_name,
      passportNumber: row.passport_number,
      contactNumber: row.contact_number,
      nationality: row.nationality,
      createdAt: row.created_at
    } as HajiMaster;
  }

  static async ensureHaji(haji: { fullName: string; passportNumber?: string; nationality?: string; contactNumber?: string }) {
    if (!haji.fullName) return null;

    const name = haji.fullName.trim();
    const passport = haji.passportNumber?.trim().toUpperCase();
    const isPassportValid = passport && passport.length > 3 && passport !== 'N/A' && passport !== 'PENDING' && passport !== 'PASSPORT';

    // 1. Try to find by BOTH Name and Passport (Strong Match)
    if (isPassportValid) {
      const { data: bothMatch } = await supabase
        .from('haji_master')
        .select('*')
        .eq('full_name', name)
        .eq('passport_number', passport)
        .maybeSingle();
      
      if (bothMatch) return this.mapToHajiMaster(bothMatch);
    }

    // 2. Try to find by Passport alone, but ONLY if name is very similar
    if (isPassportValid) {
      const existing = await this.searchByPassport(passport);
      if (existing) {
        // If the name is basically the same (case insensitive), we assume it's the same person
        if (existing.fullName.trim().toUpperCase() === name.toUpperCase()) {
          return existing;
        }
        // If name is different, we don't return it yet, because it might be a new person
        // using the same placeholder passport or a typo.
        // We will proceed to search by Name.
      }
    }

    // 3. Try to find by Name alone (Case Insensitive)
    const { data: nameMatch } = await supabase
      .from('haji_master')
      .select('*')
      .ilike('full_name', name)
      .limit(1)
      .maybeSingle();
    
    if (nameMatch) {
      // If we found a name match, and we have a new passport, maybe update it?
      // Only update if current record has no passport
      if (isPassportValid && (!nameMatch.passport_number || nameMatch.passport_number === 'N/A')) {
        return await this.update(nameMatch.id, { passportNumber: passport });
      }
      return this.mapToHajiMaster(nameMatch);
    }

    // 4. Not found by Name or Passport (or Passport matched different person), Create New
    return await this.create({
      fullName: name,
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
