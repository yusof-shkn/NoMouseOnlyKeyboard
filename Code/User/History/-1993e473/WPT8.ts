// src/features/restrictedMode/restrictedMode.slice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { supabase } from '@app/core/supabase/Supabase.utils'

// ─────────────────────────────────────────────
// State Interface
// ─────────────────────────────────────────────

interface RestrictedModeState {
  isUnlocked: boolean // false = locked (restricted records hidden)
  isLoading: boolean // true while verifying password
  error: string | null // wrong password or other error message
}

const initialState: RestrictedModeState = {
  isUnlocked: false,
  isLoading: false,
  error: null,
}

// ─────────────────────────────────────────────
// Async Thunk — Unlock (verify password)
// ─────────────────────────────────────────────

export const unlockRestrictedMode = createAsyncThunk(
  'restrictedMode/unlock',
  async (
    { password, companyId }: { password: string; companyId: number },
    { rejectWithValue },
  ) => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('restricted_mode_password')
        .eq('company_id', companyId)
        .single()

      if (error) throw error

      // No password set yet
      if (!data?.restricted_mode_password) {
        return rejectWithValue(
          'No restricted mode password has been set. Please configure it in Settings.',
        )
      }

      // Compare plain text password (hashing can be added later)
      if (data.restricted_mode_password !== password) {
        return rejectWithValue('Incorrect password. Please try again.')
      }

      return true
    } catch (err: any) {
      return rejectWithValue(err?.message || 'Failed to verify password.')
    }
  },
)

// ─────────────────────────────────────────────
// Async Thunk — Set / Update Password
// ─────────────────────────────────────────────

export const setRestrictedModePassword = createAsyncThunk(
  'restrictedMode/setPassword',
  async (
    { password, companyId }: { password: string; companyId: number },
    { rejectWithValue },
  ) => {
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          restricted_mode_password: password,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)

      if (error) throw error

      return true
    } catch (err: any) {
      return rejectWithValue(err?.message || 'Failed to save password.')
    }
  },
)

// ─────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────

const restrictedModeSlice = createSlice({
  name: 'restrictedMode',
  initialState,
  reducers: {
    /**
     * Lock restricted mode — no password needed to lock
     */
    lockRestrictedMode: (state) => {
      state.isUnlocked = false
      state.error = null
    },

    /**
     * Clear any error message (e.g. when closing the modal)
     */
    clearRestrictedModeError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    // ── Unlock ──
    builder
      .addCase(unlockRestrictedMode.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(unlockRestrictedMode.fulfilled, (state) => {
        state.isLoading = false
        state.isUnlocked = true
        state.error = null
      })
      .addCase(unlockRestrictedMode.rejected, (state, action) => {
        state.isLoading = false
        state.isUnlocked = false
        state.error = action.payload as string
      })

    // ── Set Password ──
    builder
      .addCase(setRestrictedModePassword.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(setRestrictedModePassword.fulfilled, (state) => {
        state.isLoading = false
        state.error = null
      })
      .addCase(setRestrictedModePassword.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

export const { lockRestrictedMode, clearRestrictedModeError } =
  restrictedModeSlice.actions

export default restrictedModeSlice.reducer

// ─────────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────────

export const selectIsUnlocked = (state: {
  restrictedMode: RestrictedModeState
}) => state.restrictedMode.isUnlocked

export const selectRestrictedModeLoading = (state: {
  restrictedMode: RestrictedModeState
}) => state.restrictedMode.isLoading

export const selectRestrictedModeError = (state: {
  restrictedMode: RestrictedModeState
}) => state.restrictedMode.error

