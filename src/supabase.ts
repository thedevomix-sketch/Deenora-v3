
/**
 * DEPRECATED: This file is kept for backward compatibility during transition.
 * Future logic should use:
 * - import { supabase } from './lib/supabase'
 * - import { smsService } from './services/smsService'
 * - import { offlineService } from './services/offlineService'
 */

import { supabase } from './lib/supabase';
import { smsService } from './services/smsService';
import { offlineService } from './services/offlineService';

export { supabase };
export const smsApi = smsService;
export const offlineApi = offlineService;
