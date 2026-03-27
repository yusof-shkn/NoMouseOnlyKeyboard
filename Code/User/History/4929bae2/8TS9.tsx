/**
 * DashboardLayout.tsx
 *
 * Full-screen skeleton shown during initial app boot (before auth resolves).
 * Matches the real AppShell layout:
 *   - AppShell.Navbar: width=260, border-right 1.5px, bg white/dark[7] — contains SidebarSkeleton
 *   - AppShell.Header: height=56, border-bottom, bg white/dark[8] — NavbarSkeleton
 *   - AppShell.Main: padding, bg gradient — LayoutSkeleton
 */
import React from 'react'
import { useMantineTheme, useMantineColorScheme } from '@mantine/core'
import { ShimmerStyle } from './ShimmerStyle'
import { SidebarSkeleton } from './Sidebar.skeleton'
import NavbarSkeleton from './Navbar.skeleton'
import LayoutSkeleton from './Layout.skeleton'

const SIDEBAR_WIDTH = 260

export const DashboardSkeleton: React.FC = () => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const sidebarBg  = isDark ? theme.colors.dark[7] : theme.white
  const sidebarBorder = isDark ? theme.colors.dark[4] : theme.colors.gray[3]

  const mainBg = isDark
    ? theme.colors.dark[8]
    : 'linear-gradient(135deg, #F5F7FA 0%, #E8ECF0 100%)'

  return (
    <>
      <ShimmerStyle />
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* AppShell.Navbar — 260px, border-right 1.5px, p="md" (16px) */}
        <div
          style={{
            width: SIDEBAR_WIDTH,
            minWidth: SIDEBAR_WIDTH,
            height: '100%',
            background: sidebarBg,
            borderRight: `1.5px solid ${sidebarBorder}`,
            padding: 16,
            overflowY: 'hidden',
            flexShrink: 0,
          }}
        >
          <SidebarSkeleton />
        </div>

        {/* Main column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* AppShell.Header — height 56px */}
          <NavbarSkeleton />

          {/* AppShell.Main content area */}
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              padding: '1rem 2rem',
              background: mainBg,
            }}
          >
            <LayoutSkeleton />
          </div>
        </div>
      </div>
    </>
  )
}

export default DashboardSkeleton
