
/**
 * DEPRECATED: This file is kept for backward compatibility during transition.
 * Future logic should use:
 * - import { supabase } from './lib/supabase'
 * - import { smsService } from './services/SMSService'
 * - import { offlineService } from './services/OfflineService'
 */

import { supabase } from './lib/supabase';
import { smsService } from './services/SMSService';
import { offlineService } from './services/OfflineService';

export { supabase };
export const smsApi = smsService;
export const offlineApi = offlineService;
