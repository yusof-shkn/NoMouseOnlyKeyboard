import React from 'react'
import ReactDOM from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './features/auth/context/AuthContext'
import { lotusTheme } from './app/theme/theme'
import { router } from './app/routes'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider
      theme={lotusTheme}
      defaultColorScheme="light"
    >
      <Notifications
        position="top-center"
        zIndex={9999}
        autoClose={2200}
        limit={2}
        containerWidth={310}
        styles={{
          root: {
            top: '12px !important' as string,
            left: '50% !important' as string,
            transform: 'translateX(-50%) !important' as string,
            right: 'unset !important' as string,
            bottom: 'unset !important' as string,
            width: '310px',
            maxWidth: 'calc(100vw - 24px)',
          },
          notification: {
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12.5px',
            padding: '8px 12px',
            borderRadius: '12px',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            backdropFilter: 'blur(12px)',
            minHeight: 'unset',
          },
        }}
      />
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </MantineProvider>
  </React.StrictMode>,
)

