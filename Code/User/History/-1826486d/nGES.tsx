import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react'
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
  /** Currently active profile */
  activeStaffProfile: InsuranceStaffProfile | null
  profilePickerOpen: boolean
  selectStaffProfile: (id: string) => void
  dismissProfilePicker: () => void
  openProfilePicker: () => void
  refreshStaffProfiles: (pendingSelectId?: string) => Promise<void>
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
  refreshStaffProfiles: async (_?: string) => {},
})

export function InsuranceStaffProvider({
  children,
}: {
  children: ReactNode
}): JSX.Element {
  const { user } = useAuth()
  const [staffInfo, setStaffInfo] = useState<InsuranceStaffInfo | null>(null)
  const [staffLoading, setStaffLoading] = useState(true)
  const [staffProfiles, setStaffProfiles] = useState<InsuranceStaffProfile[]>(
    [],
  )
  const [activeStaffProfile, setActiveStaffProfile] =
    useState<InsuranceStaffProfile | null>(null)
  const [profilePickerOpen, setProfilePickerOpen] = useState(false)
  const activeProfileIdRef = useRef<string | null>(null)

  const loadProfiles = async (): Promise<void> => {
    const [siResult, profilesResult] = await Promise.all([
      supabase.rpc('get_my_insurance_staff_info'),
      supabase.rpc('get_my_insurance_staff_profiles'),
    ])

    const si = siResult.data
    if (si && (si as InsuranceStaffInfo).id) {
      setStaffInfo(si as InsuranceStaffInfo)
    }

    const profiles = (profilesResult.data ?? []) as InsuranceStaffProfile[]
    setStaffProfiles(profiles)

    // Try to restore a saved selection
    const savedId = localStorage.getItem(SELECTED_INS_PROFILE_KEY)
    const saved = savedId ? profiles.find((p) => p.id === savedId) : null

    if (saved) {
      // Restore the saved profile — no picker needed
      setActiveStaffProfile(saved)
      activeProfileIdRef.current = saved.id
    } else if (profiles.length === 1) {
      // Only one profile — auto-select it silently
      const only = profiles[0]
      setActiveStaffProfile(only)
      activeProfileIdRef.current = only.id
      localStorage.setItem(SELECTED_INS_PROFILE_KEY, only.id)
    } else if (profiles.length > 1) {
      // Multiple profiles and no saved choice — show the picker
      const main = profiles.find((p) => p.is_main) ?? null
      if (main) {
        // Pre-highlight main but still open picker so user consciously chooses
        setActiveStaffProfile(main)
        activeProfileIdRef.current = main.id
      }
      setProfilePickerOpen(true)
    }

    setStaffLoading(false)
  }

  useEffect(() => {
    if (!user) return
    // Clear saved selection on each login so the picker appears on fresh sessions
    localStorage.removeItem(SELECTED_INS_PROFILE_KEY)
    activeProfileIdRef.current = null
    loadProfiles()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshStaffProfiles = async (
    pendingSelectId?: string,
  ): Promise<void> => {
    const [siResult, profilesResult] = await Promise.all([
      supabase.rpc('get_my_insurance_staff_info'),
      supabase.rpc('get_my_insurance_staff_profiles'),
    ])

    const si = siResult.data
    if (si && (si as InsuranceStaffInfo).id) {
      setStaffInfo(si as InsuranceStaffInfo)
    }

    const profiles = (profilesResult.data ?? []) as InsuranceStaffProfile[]
    setStaffProfiles(profiles)

    // Priority 0: if a specific ID was just created/requested, select it directly from fresh data
    // (avoids stale-closure problems — profiles here is from DB, not React state)
    if (pendingSelectId) {
      const found = profiles.find((p) => p.id === pendingSelectId)
      if (found) {
        setActiveStaffProfile(found)
        activeProfileIdRef.current = found.id
        localStorage.setItem(SELECTED_INS_PROFILE_KEY, found.id)
        return
      }
    }

    // Priority 1: check localStorage for a saved/pending selection (set by selectStaffProfile
    // or written before refresh — this survives the React state batch timing issue)
    const savedId = localStorage.getItem(SELECTED_INS_PROFILE_KEY)
    if (savedId) {
      const saved = profiles.find((p) => p.id === savedId)
      if (saved) {
        setActiveStaffProfile(saved)
        activeProfileIdRef.current = saved.id
        return
      }
    }

    // Priority 2: keep the currently active profile if it still exists
    if (activeProfileIdRef.current) {
      const refreshed = profiles.find(
        (p) => p.id === activeProfileIdRef.current,
      )
      if (refreshed) {
        setActiveStaffProfile(refreshed)
        return
      }
    }

    // Fallback: main profile or first
    const main = profiles.find((p) => p.is_main) ?? profiles[0] ?? null
    setActiveStaffProfile(main)
    if (main) {
      activeProfileIdRef.current = main.id
      localStorage.setItem(SELECTED_INS_PROFILE_KEY, main.id)
    }
  }

  const selectStaffProfile = (id: string): void => {
    // Always persist to localStorage and ref FIRST so that refreshStaffProfiles
    // (which may run concurrently) can pick up the selection even if React
    // state hasn't committed the new staffProfiles array yet.
    activeProfileIdRef.current = id
    localStorage.setItem(SELECTED_INS_PROFILE_KEY, id)
    const found = staffProfiles.find((p) => p.id === id)
    // found may be undefined if called before refreshStaffProfiles commits state —
    // that's fine: localStorage + ref ensure the next render picks it up correctly.
    if (found) setActiveStaffProfile(found)
    setProfilePickerOpen(false)
  }

  const dismissProfilePicker = (): void => {
    // If nothing is active yet, auto-select the main profile
    if (!activeStaffProfile) {
      const main =
        staffProfiles.find((p) => p.is_main) ?? staffProfiles[0] ?? null
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
    <InsuranceStaffContext.Provider
      value={{
        staffInfo,
        staffLoading,
        staffProfiles,
        activeStaffProfile,
        profilePickerOpen,
        selectStaffProfile,
        dismissProfilePicker,
        openProfilePicker,
        refreshStaffProfiles,
      }}
    >
      {children}
    </InsuranceStaffContext.Provider>
  )
}

export const useInsuranceStaff = (): InsuranceStaffContextValue =>
  useContext(InsuranceStaffContext)

