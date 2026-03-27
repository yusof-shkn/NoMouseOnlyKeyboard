// @features/settings/companySettings/data/creditSettings.queries.ts

import { supabase } from '@app/core/supabase/Supabase.utils'

export interface CreditSettings {
  default_credit_days: number
  grace_period_days: number
  late_fee: number
  interest_rate: number
  require_credit_approval: boolean
  require_transaction_approval: boolean
  large_transaction_threshold: number
  notify_payment_due: boolean
  notify_payment_overdue: boolean
  notify_credit_limit: boolean
  reminder_days_before: number
  enable_credit_management: boolean
  auto_suspend_overdue: boolean
  suspension_grace_days: number
  credit_check_required: boolean
  min_payment_percentage: number
}

/**
 * Get credit settings from JSONB column in company_settings
 */
export const getCreditSettings = async (companyId: number) => {
  const { data, error } = await supabase
    .from('company_settings')
    .select('credit_settings')
    .eq('company_id', companyId)
    .single()

  if (!data?.credit_settings) {
    return {
      data: {
        default_credit_days: 30,
        grace_period_days: 7,
        late_fee: 0,
        interest_rate: 0,
        require_credit_approval: false,
        require_transaction_approval: false,
        large_transaction_threshold: 0,
        notify_payment_due: true,
        notify_payment_overdue: true,
        notify_credit_limit: true,
        reminder_days_before: 3,
        enable_credit_management: true,
        auto_suspend_overdue: false,
        suspension_grace_days: 30,
        credit_check_required: false,
        min_payment_percentage: 0,
      } as CreditSettings,
      error: null,
    }
  }

  return { data: data.credit_settings as CreditSettings, error }
}

/**
 * Update credit settings in JSONB column
 */
export const updateCreditSettings = async (
  companyId: number,
  settings: Partial<CreditSettings>,
) => {
  const { data: currentData } = await supabase
    .from('company_settings')
    .select('credit_settings')
    .eq('company_id', companyId)
    .single()

  const updatedSettings = {
    ...(currentData?.credit_settings || {}),
    ...settings,
  }

  return await supabase
    .from('company_settings')
    .update({ credit_settings: updatedSettings })
    .eq('company_id', companyId)
    .select('credit_settings')
    .single()
}

