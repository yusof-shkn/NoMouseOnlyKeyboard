/home/yusof_0090/Downloads/fixed-context/InsuranceStaffContext.tsximport { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../auth/context/AuthContext'

const SELECTED_INS_PROFILE_KEY = 'meddelivery_ins_staff_profile_id'

export interface InsuranceStaffInfo {
  id: string
  name: string
  role: string
  insurance_provider_id: string
  provider_name: string
}

export interface InsuranceStaffProfile {
  id: string
  staff_id: string
  display_name: string
  title: string | null
  is_main: boolean
  created_at: string
  provider_name: string
}

interface InsuranceStaffContextValue {
  staffInfo: InsuranceStaffInfo | null
  staffLoading: boolean
  /** All named profiles for this staff account */
  staffProfiles: InsuranceStaffProfile[]
  /** Currently active actor profile */
  activeStaffProfile: InsuranceStaffProfile | null
  profilePickerOpen: boolean
  selectStaffProfile: (id: string) => void
  dismissProfilePicker: () => void
  openProfilePicker: () => void
  refreshStaffProfiles: () => Promise<void>
}

const InsuranceStaffContext = createContext<InsuranceStaffContextValue>({
  staffInfo: null,
  staffLoading: true,
  staffProfiles: [],
  activeStaffProfile: null,
  profilePickerOpen: false,
  selectStaffProfile: () => {},
  dismissProfilePicker: () => {},
  openProfilePicker: () => {},
  refreshStaffProfiles: async () => {},
})

export function InsuranceStaffProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useAuth()
  const [staffInfo, setStaffInfo]             = useState<InsuranceStaffInfo | null>(null)
  const [staffLoading, setStaffLoading]       = useState(true)
  const [staffProfiles, setStaffProfiles]     = useState<InsuranceStaffProfile[]>([])
  const [activeStaffProfile, setActiveStaffProfile] = useState<InsuranceStaffProfile | null>(null)
  const [profilePickerOpen, setProfilePickerOpen]   = useState(false)
  const activeProfileIdRef = useRef<string | null>(null)

  const loadProfiles = async (showPicker = false): Promise<void> => {
    const { data: si } = await supabase.rpc('get_my_insurance_staff_info')
    if (!si || !(si as InsuranceStaffInfo).id) {
      setStaffLoading(false)
      return
    }
    setStaffInfo(si as InsuranceStaffInfo)

    const { data: profilesData } = await supabase.rpc('get_my_insurance_staff_profiles')
    const profiles = (profilesData ?? []) as InsuranceStaffProfile[]
    setStaffProfiles(profiles)

    // On login (showPicker=true), always clear saved selection so picker shows
    if (showPicker) {
      localStorage.removeItem(SELECTED_INS_PROFILE_KEY)
      activeProfileIdRef.current = null
    }

    const savedId = showPicker ? null : localStorage.getItem(SELECTED_INS_PROFILE_KEY)
    const saved = savedId ? profiles.find(p => p.id === savedId) : null

    if (saved) {
      setActiveStaffProfile(saved)
      activeProfileIdRef.current = saved.id
    } else if (activeProfileIdRef.current) {
      const refreshed = profiles.find(p => p.id === activeProfileIdRef.current)
      if (refreshed) {
        setActiveStaffProfile(refreshed)
      } else {
        const main = profiles.find(p => p.is_main) ?? profiles[0] ?? null
        setActiveStaffProfile(main)
        activeProfileIdRef.current = main?.id ?? null
      }
    } else {
      const main = profiles.find(p => p.is_main) ?? profiles[0] ?? null
      if (main) {
        if (showPicker) {
          setProfilePickerOpen(true)
        } else {
          setActiveStaffProfile(main)
          activeProfileIdRef.current = main.id
        }
      }
    }

    setStaffLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadProfiles(true)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshStaffProfiles = async (): Promise<void> => {
    await loadProfiles(false)
  }

  const selectStaffProfile = (id: string): void => {
    const found = staffProfiles.find(p => p.id === id)
    if (found) {
      setActiveStaffProfile(found)
      activeProfileIdRef.current = id
      localStorage.setItem(SELECTED_INS_PROFILE_KEY, id)
    }
    setProfilePickerOpen(false)
  }

  const dismissProfilePicker = (): void => {
    if (!activeStaffProfile) {
      const main = staffProfiles.find(p => p.is_main) ?? staffProfiles[0] ?? null
      setActiveStaffProfile(main)
      if (main) {
        activeProfileIdRef.current = main.id
        localStorage.setItem(SELECTED_INS_PROFILE_KEY, main.id)
      }
    }
    setProfilePickerOpen(false)
  }

  const openProfilePicker = (): void => setProfilePickerOpen(true)

  return (
    <InsuranceStaffContext.Provider value={{
      staffInfo, staffLoading, staffProfiles, activeStaffProfile,
      profilePickerOpen, selectStaffProfile, dismissProfilePicker,
      openProfilePicker, refreshStaffProfiles,
    }}>
      {children}
    </InsuranceStaffContext.Provider>
  )
}

export const useInsuranceStaff = (): InsuranceStaffContextValue => useContext(InsuranceStaffContext)
