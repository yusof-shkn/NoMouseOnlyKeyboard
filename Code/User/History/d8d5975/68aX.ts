import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../auth/context/AuthContext'
import type { DbInsurance } from '../../../../lib/supabase'
import type { InsuranceFormData } from '../../../../app/components/InsuranceModal'

export interface EditProfileFormValues {
  name: string
  email: string
  phone: string
  dateOfBirth: string
  relationship: string
}

export interface ChronicFormValues {
  nin: string
  is_chronic: boolean
  chronic_conditions: string
  current_medications: string
  medication_duration: string
  last_refill_date: string
  refill_interval_days: string
}

export interface InsuranceEntry {
  id?: string
  companyName: string
  schemeName: string
  medicalCardNumber: string
  gender: string
  status?: string
  expiryDate?: string
  isNew?: boolean
  toDelete?: boolean
}

function validate(
  v: EditProfileFormValues,
): Partial<Record<keyof EditProfileFormValues, string>> {
  const e: Partial<Record<keyof EditProfileFormValues, string>> = {}
  if (!v.name?.trim() || v.name.trim().length < 2)
    e.name = 'Full name must be at least 2 characters'
  if (/\d/.test(v.name?.trim() ?? ''))
    e.name = 'Name should not contain numbers'
  if (v.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))
    e.email = 'Enter a valid email address (e.g. you@example.com)'
  if (v.phone?.trim()) {
    const cleaned = v.phone.trim().replace(/[\s()+-]/g, '')
    if (!/^\d{7,15}$/.test(cleaned))
      e.phone =
        'Enter a valid phone number (7–15 digits, e.g. +256 700 123 456)'
  }
  if (v.dateOfBirth) {
    const dob = new Date(v.dateOfBirth)
    const now = new Date()
    if (dob > now) e.dateOfBirth = 'Date of birth cannot be in the future'
    const age = now.getFullYear() - dob.getFullYear()
    if (age > 120) e.dateOfBirth = 'Please enter a valid date of birth'
  }
  return e
}

export function useEditProfileForm({
  openInsurance = false,
}: { openInsurance?: boolean } = {}) {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user, refreshProfile } = useAuth()

  const [resolvedId, setResolvedId] = useState<string | null>(null)
  const [isMainAccount, setIsMainAccount] = useState(false)
  const [originalPhone, setOriginalPhone] = useState<string>('')
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [insuranceStatus, setInsuranceStatus] = useState<string | null>(null)
  const [insuranceRejectionReason, setInsuranceRejectionReason] = useState<
    string | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<
    Partial<Record<keyof EditProfileFormValues, string>>
  >({})
  const [existingInsurances, setExistingInsurances] = useState<
    InsuranceEntry[]
  >([])

  const [chronic, setChronic] = useState<ChronicFormValues>({
    nin: '',
    is_chronic: false,
    chronic_conditions: '',
    current_medications: '',
    medication_duration: '',
    last_refill_date: '',
    refill_interval_days: '',
  })

  const [values, setValues] = useState<EditProfileFormValues>({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    relationship: '',
  })

  const set = <K extends keyof EditProfileFormValues>(
    key: K,
    val: EditProfileFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: val }))
    if (errors[key])
      setErrors((prev) => {
        const n = { ...prev }
        delete n[key]
        return n
      })
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let profileId = id
      if (id === 'me') {
        if (!user) {
          setLoading(false)
          return
        }
        const { data: main } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_main_account', true)
          .single()
        if (!main) {
          setLoading(false)
          return
        }
        profileId = main.id
      }
      if (!profileId) {
        setLoading(false)
        return
      }
      setResolvedId(profileId)

      const { data, error } = await supabase
        .from('profiles')
        .select('*, insurance(*)')
        .eq('id', profileId)
        .single()
      if (error || !data) {
        setLoading(false)
        return
      }

      const rawIns: DbInsurance[] = Array.isArray(data.insurance)
        ? (data.insurance as DbInsurance[])
        : data.insurance
          ? [data.insurance as DbInsurance]
          : []

      setExistingPhotoUrl(data.photo_url || null)
      setIsMainAccount(!!data.is_main_account)

      const loadedPhone = (data.phone as string) || ''
      setOriginalPhone(loadedPhone)

      if (rawIns.length > 0) {
        setInsuranceStatus(rawIns[0].status || null)
        setInsuranceRejectionReason(rawIns[0].rejection_reason || null)
      }

      setExistingInsurances(
        rawIns.map((ins) => ({
          id: ins.id,
          companyName: ins.provider ?? '',
          schemeName: ins.scheme_name ?? '',
          medicalCardNumber: ins.policy_number ?? '',
          gender: ins.gender ?? '',
          status: ins.status,
          expiryDate: ins.expiry_date,
        })),
      )

      // Load chronic fields
      const d = data as Record<string, unknown>
      setChronic({
        nin: (d.nin as string) ?? '',
        is_chronic: (d.is_chronic as boolean) ?? false,
        chronic_conditions: (d.chronic_conditions as string) ?? '',
        current_medications: (d.current_medications as string) ?? '',
        medication_duration: (d.medication_duration as string) ?? '',
        last_refill_date: (d.last_refill_date as string) ?? '',
        refill_interval_days:
          d.refill_interval_days != null ? String(d.refill_interval_days) : '',
      })

      setValues({
        name: (d.name as string) || '',
        email: (d.email as string | null | undefined) ?? '',
        phone: loadedPhone,
        dateOfBirth: (d.date_of_birth as string | null | undefined) ?? '',
        relationship: (d.relationship as string) || '',
      })

      setLoading(false)
    }
    load()
  }, [id, user, openInsurance]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Principal only — sends OTP to new phone number via Supabase auth */
  const requestPhoneChangeOtp = async (newPhone: string): Promise<boolean> => {
    const { error } = await supabase.auth.updateUser({ phone: newPhone })
    if (error) {
      notifications.show({
        title: 'Could not send OTP',
        message: error.message,
        color: 'red',
        autoClose: 3000,
      })
      return false
    }
    return true
  }

  /** Confirms OTP token for principal phone change */
  const verifyPhoneChangeOtp = async (
    newPhone: string,
    token: string,
  ): Promise<boolean> => {
    const { error } = await supabase.auth.verifyOtp({
      phone: newPhone,
      token,
      type: 'phone_change',
    })
    if (error) {
      notifications.show({
        title: 'Invalid OTP',
        message: 'The code is incorrect or expired.',
        color: 'red',
        autoClose: 3000,
      })
      return false
    }
    return true
  }

  const addInsurance = (data: InsuranceFormData): void => {
    setExistingInsurances((prev) => [
      ...prev,
      {
        companyName: data.companyName,
        schemeName: data.schemeName,
        medicalCardNumber: data.medicalCardNumber,
        gender: data.gender,
        status: 'pending',
        isNew: true,
      },
    ])
  }

  const updateInsurance = (idx: number, data: InsuranceFormData): void => {
    setExistingInsurances((prev) =>
      prev.map((ins, i) =>
        i === idx
          ? {
              ...ins,
              companyName: data.companyName,
              schemeName: data.schemeName,
              medicalCardNumber: data.medicalCardNumber,
              gender: data.gender,
              status: 'pending',
            }
          : ins,
      ),
    )
  }

  const removeInsurance = (idx: number): void => {
    setExistingInsurances((prev) => {
      const ins = prev[idx]
      if (ins.id)
        return prev.map((x, i) => (i === idx ? { ...x, toDelete: true } : x))
      return prev.filter((_, i) => i !== idx)
    })
  }

  /**
   * Immediately persist a new or updated insurance record to Supabase
   * without requiring the main "Save Changes" button to be pressed.
   */
  const saveInsuranceNow = async (
    data: InsuranceFormData,
    existingId?: string,
  ): Promise<boolean> => {
    const targetId = resolvedId
    if (!targetId) return false

    const payload = {
      provider: data.companyName.trim(),
      scheme_name: data.schemeName?.trim() || null,
      policy_number: data.medicalCardNumber.trim(),
      policy_holder_name: '',
      gender: data.gender || null,
      status: 'pending' as const,
      updated_at: new Date().toISOString(),
    }

    if (existingId) {
      const { error } = await supabase
        .from('insurance')
        .update(payload)
        .eq('id', existingId)
      if (error) {
        notifications.show({
          title: 'Insurance save failed',
          message: error.message,
          color: 'red',
          autoClose: 3000,
        })
        return false
      }
      setExistingInsurances((prev) =>
        prev.map((ins) =>
          ins.id === existingId
            ? {
                ...ins,
                companyName: data.companyName,
                schemeName: data.schemeName,
                medicalCardNumber: data.medicalCardNumber,
                gender: data.gender,
                status: 'pending',
              }
            : ins,
        ),
      )
    } else {
      const { data: inserted, error } = await supabase
        .from('insurance')
        .insert({
          ...payload,
          profile_id: targetId,
          expiry_date: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          member_type: (() => {
            const r = values.relationship
            if (!r || r === 'Self') return 'Principal'
            if (r === 'Spouse') return 'Spouse'
            if (r === 'Child') return 'Child'
            return 'Dependent'
          })(),
        })
        .select()
        .single()
      if (error) {
        notifications.show({
          title: 'Insurance save failed',
          message: error.message,
          color: 'red',
          autoClose: 3000,
        })
        return false
      }
      const newEntry = inserted as { id: string }
      setExistingInsurances((prev) => [
        ...prev.filter((ins) => !ins.isNew),
        {
          id: newEntry.id,
          companyName: data.companyName,
          schemeName: data.schemeName,
          medicalCardNumber: data.medicalCardNumber,
          gender: data.gender,
          status: 'pending',
        },
      ])
    }
    return true
  }

  /**
   * Immediately delete an insurance record from Supabase.
   */
  const removeInsuranceNow = async (idx: number): Promise<void> => {
    const ins = existingInsurances[idx]
    if (ins.id) {
      const { error } = await supabase
        .from('insurance')
        .delete()
        .eq('id', ins.id)
      if (error) {
        notifications.show({
          title: 'Remove failed',
          message: error.message,
          color: 'red',
          autoClose: 2500,
        })
        return
      }
      setExistingInsurances((prev) => prev.filter((_, i) => i !== idx))
    } else {
      setExistingInsurances((prev) => prev.filter((_, i) => i !== idx))
    }
  }

  const onSubmit = async (photoFile?: File | null) => {
    const errs = validate(values)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      notifications.show({
        title: 'Fix errors',
        message: Object.values(errs)[0],
        color: 'red',
        autoClose: 2500,
      })
      return
    }

    const targetId = resolvedId
    if (!targetId) return
    setSubmitting(true)

    // Photo upload
    let photoUrl: string | undefined
    if (photoFile) {
      const filePath = `profiles/${targetId}/${Date.now()}-${photoFile.name}`
      const { error: upErr } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, photoFile)
      if (!upErr) {
        const {
          data: { publicUrl },
        } = supabase.storage.from('profile-photos').getPublicUrl(filePath)
        photoUrl = publicUrl
      } else {
        notifications.show({
          title: 'Photo upload failed',
          message: upErr.message,
          color: 'orange',
          autoClose: 2500,
        })
      }
    }

    // Save profile — email and phone both go to profiles table
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        name: values.name.trim(),
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        date_of_birth: values.dateOfBirth || null,
        relationship: isMainAccount ? 'Self' : values.relationship || null,
        ...(photoUrl ? { photo_url: photoUrl } : {}),
        // NIN + chronic
        nin: chronic.nin?.trim() || null,
        is_chronic: chronic.is_chronic,
        chronic_conditions: chronic.is_chronic
          ? chronic.chronic_conditions?.trim() || null
          : null,
        current_medications: chronic.is_chronic
          ? chronic.current_medications?.trim() || null
          : null,
        medication_duration: chronic.is_chronic
          ? chronic.medication_duration?.trim() || null
          : null,
        last_refill_date: chronic.is_chronic
          ? chronic.last_refill_date || null
          : null,
        refill_interval_days:
          chronic.is_chronic && chronic.refill_interval_days
            ? parseInt(chronic.refill_interval_days)
            : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId)

    if (profileErr) {
      notifications.show({
        title: 'Failed to save',
        message: profileErr.message,
        color: 'red',
        autoClose: 2500,
      })
      setSubmitting(false)
      return
    }

    // Insurance records
    let insuranceError: string | null = null
    for (const ins of existingInsurances) {
      if (ins.toDelete && ins.id) {
        const { error } = await supabase
          .from('insurance')
          .delete()
          .eq('id', ins.id)
        if (error) {
          insuranceError = error.message
          break
        }
        continue
      }
      if (ins.toDelete) continue

      const payload = {
        provider: ins.companyName.trim(),
        scheme_name: ins.schemeName?.trim() || null,
        policy_number: ins.medicalCardNumber.trim(),
        policy_holder_name: '',
        gender: ins.gender || null,
        updated_at: new Date().toISOString(),
      }

      if (ins.id) {
        const { error } = await supabase
          .from('insurance')
          .update({ ...payload, status: 'pending' })
          .eq('id', ins.id)
        if (error) {
          insuranceError = error.message
          break
        }
      } else if (
        ins.isNew &&
        ins.companyName.trim() &&
        ins.medicalCardNumber.trim()
      ) {
        const { error } = await supabase.from('insurance').insert({
          ...payload,
          profile_id: targetId,
          expiry_date: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          status: 'pending',
          member_type: (() => {
            const r = values.relationship
            if (!r || r === 'Self') return 'Principal'
            if (r === 'Spouse') return 'Spouse'
            if (r === 'Child') return 'Child'
            return 'Dependent'
          })(),
        })
        if (error) {
          insuranceError = error.message
          break
        }
      }
    }

    if (insuranceError) {
      notifications.show({
        title: 'Insurance save failed',
        message: insuranceError,
        color: 'red',
        autoClose: 4000,
      })
      setSubmitting(false)
      return
    }

    notifications.show({
      title: 'Saved',
      message: 'Profile updated.',
      color: 'teal',
      autoClose: 2000,
    })
    setSubmitting(false)
    await refreshProfile()
    navigate('/dashboard')
  }

  const deleteProfile = async () => {
    const targetId = resolvedId
    if (!targetId) return
    for (const ins of existingInsurances) {
      if (ins.id) await supabase.from('insurance').delete().eq('id', ins.id)
    }
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', targetId)
    if (error) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
        autoClose: 2500,
      })
      return
    }
    notifications.show({
      title: 'Deleted',
      message: 'Profile removed.',
      color: 'gray',
      autoClose: 2000,
    })
    await refreshProfile()
    navigate('/dashboard')
  }

  const setChronicField = <K extends keyof ChronicFormValues>(
    key: K,
    val: ChronicFormValues[K],
  ): void => {
    setChronic((prev) => ({ ...prev, [key]: val }))
  }

  return {
    values,
    set,
    errors,
    onSubmit,
    submitting,
    isMainAccount,
    loading,
    originalPhone,
    requestPhoneChangeOtp,
    verifyPhoneChangeOtp,
    existingPhotoUrl,
    insuranceStatus,
    insuranceRejectionReason,
    deleteProfile,
    existingInsurances,
    addInsurance,
    updateInsurance,
    removeInsurance,
    saveInsuranceNow,
    removeInsuranceNow,
    chronic,
    setChronicField,
  }
}

