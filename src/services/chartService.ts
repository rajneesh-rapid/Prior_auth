import { supabase } from '@/lib/supabase';
import type { ChartConfig } from '@/components/ui/chart';

export interface ChartConfiguration {
  id?: string;
  chartType: string;
  config: ChartConfig;
  userId?: string | null;
}

// Fetch chart configuration by type
export async function fetchChartConfig(chartType: string, userId?: string): Promise<ChartConfiguration | null> {
  try {
    let query = supabase
      .from('chart_configurations')
      .select('*')
      .eq('chart_type', chartType);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      chartType: data.chart_type,
      config: data.config as ChartConfig,
      userId: data.user_id,
    };
  } catch (error) {
    console.error('Error fetching chart config:', error);
    throw error;
  }
}

// Fetch all chart configurations
export async function fetchAllChartConfigs(userId?: string): Promise<ChartConfiguration[]> {
  try {
    let query = supabase.from('chart_configurations').select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      chartType: row.chart_type,
      config: row.config as ChartConfig,
      userId: row.user_id,
    }));
  } catch (error) {
    console.error('Error fetching chart configs:', error);
    throw error;
  }
}

// Save chart configuration
export async function saveChartConfig(config: ChartConfiguration): Promise<ChartConfiguration> {
  try {
    const configData = {
      chart_type: config.chartType,
      config: config.config,
      user_id: config.userId || null,
    };

    if (config.id) {
      // Update existing
      const { data, error } = await supabase
        .from('chart_configurations')
        .update(configData)
        .eq('id', config.id)
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        chartType: data.chart_type,
        config: data.config as ChartConfig,
        userId: data.user_id,
      };
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('chart_configurations')
        .insert(configData)
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        chartType: data.chart_type,
        config: data.config as ChartConfig,
        userId: data.user_id,
      };
    }
  } catch (error) {
    console.error('Error saving chart config:', error);
    throw error;
  }
}

// Delete chart configuration
export async function deleteChartConfig(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('chart_configurations').delete().eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting chart config:', error);
    throw error;
  }
}

// Delete chart configuration by type
export async function deleteChartConfigByType(chartType: string, userId?: string): Promise<void> {
  try {
    let query = supabase.from('chart_configurations').delete().eq('chart_type', chartType);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { error } = await query;

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting chart config by type:', error);
    throw error;
  }
}

