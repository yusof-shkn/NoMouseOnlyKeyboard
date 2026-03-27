import { configureStore } from '@reduxjs/toolkit'
import { ReducerGenericModal } from '@shared/components/genericModal'
import areaStoreReducer from '@features/main/main.slice'
import userReducer from '@features/main/components/usersManagement/usersManagement.slice'
import purchaseOrdersReducer from '@features/purchase/components/purchaseOrdersHistory/purchaseOrdersHistorySlice'
import authReducer from '@features/authentication/authSlice'
import restrictedModeReducer from '@core/restrictedMode/Restrictedmode.slice'

export const store = configureStore({
  reducer: {
    modal: ReducerGenericModal,
    areaStore: areaStoreReducer,
    user: userReducer,
    purchaseOrders: purchaseOrdersReducer,
    auth: authReducer,
    restrictedMode: restrictedModeReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['sales/selectSale'],
        ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
        ignoredPaths: ['sales.selectedSale'],
      },
    }),
  devTools: true,
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

