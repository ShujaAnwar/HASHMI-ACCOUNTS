import { supabase } from './supabase';

export interface ActionResolution {
  id?: string;
  hajiId: string;
  actionKey: string;
  voucherId?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export class HajiActionService {
  static async getResolutions(): Promise<ActionResolution[]> {
    try {
      const { data, error } = await supabase
        .from('haji_action_resolutions')
        .select('*');

      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('Haji Action Resolutions table not found in schema cache. Please ensure supabase_schema.sql has been applied.');
          return [];
        }
        console.error('Error fetching action resolutions:', error);
        return [];
      }

      return (data || []).map(r => ({
        id: r.id,
        hajiId: r.haji_id,
        actionKey: r.action_key,
        voucherId: r.voucher_id,
        resolvedAt: r.resolved_at,
        resolvedBy: r.resolved_by
      }));
    } catch (err) {
      console.error('Unexpected error fetching resolutions:', err);
      return [];
    }
  }

  static async resolveAction(resolution: Omit<ActionResolution, 'id' | 'resolvedAt'>) {
    try {
      const { data, error } = await supabase
        .from('haji_action_resolutions')
        .insert({
          haji_id: resolution.hajiId,
          action_key: resolution.actionKey,
          voucher_id: resolution.voucherId,
          resolved_by: resolution.resolvedBy || 'System User'
        })
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('Haji Action Resolutions table not found. Action resolution will be temporary.');
        }
        if (error.code === '23505') {
          console.log('Action already resolved in database.');
          return {
            hajiId: resolution.hajiId,
            actionKey: resolution.actionKey,
            voucherId: resolution.voucherId,
            resolvedAt: new Date().toISOString(),
            resolvedBy: resolution.resolvedBy || 'System User'
          } as ActionResolution;
        }
        console.error('Error saving action resolution:', error);
        throw error;
      }

      return {
        id: data.id,
        hajiId: data.haji_id,
        actionKey: data.action_key,
        voucherId: data.voucher_id,
        resolvedAt: data.resolved_at,
        resolvedBy: data.resolved_by
      } as ActionResolution;
    } catch (err) {
      console.error('Unexpected error in resolveAction:', err);
      throw err;
    }
  }

  static async reopenAction(hajiId: string, actionKey: string, voucherId?: string) {
    let query = supabase
      .from('haji_action_resolutions')
      .delete()
      .eq('haji_id', hajiId)
      .eq('action_key', actionKey);
    
    if (voucherId) {
      query = query.eq('voucher_id', voucherId);
    } else {
      query = query.is('voucher_id', null);
    }

    const { error } = await query;
    if (error) {
      console.error('Error reopening action:', error);
      throw error;
    }
    return true;
  }
}
