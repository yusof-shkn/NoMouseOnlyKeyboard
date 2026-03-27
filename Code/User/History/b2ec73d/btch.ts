// src/features/sales/styles.tsx
import styled from 'styled-components'
import { Card, Paper } from '@mantine/core'

export const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
`

export const MainContent = styled.div`
  display: flex;
  height: calc(100vh - 60px);
  overflow: hidden;
`

export const ProductsSection = styled.div<{ $fullWidth: boolean }>`
  width: ${(props) => (props.$fullWidth ? '100%' : '60%')};
  padding: 16px;
  display: flex;
  flex-direction: column;
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
`

export const ProductsHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`

export const ToggleButtonsGroup = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
`

export const PurchaseSection = styled.div<{ $hidden: boolean }>`
  width: ${(props) => (props.$hidden ? '0' : '40%')};
  min-width: ${(props) => (props.$hidden ? '0' : '340px')};
  padding: ${(props) => (props.$hidden ? '0' : '12px')};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition:
    width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    min-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    padding 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s ease;
  opacity: ${(props) => (props.$hidden ? '0' : '1')};
`

export const OrderItemsContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-bottom: 8px;
  padding-right: 4px;
  min-height: 0;

  &::webkitscrollbar {
    width: 6px;
  }

  &::webkitscrollbarthumb {
    background: var(--mantine-color-gray-4);
    border-radius: 3px;
  }

  &::webkitscrollbartrack {
    background: var(--mantine-color-gray-1);
  }

  /* Dark mode scrollbar */
  @media (prefers-color-scheme: dark) {
    &::webkitscrollbarthumb {
      background: var(--mantine-color-dark-4);
    }

    &::webkitscrollbartrack {
      background: var(--mantine-color-dark-6);
    }
  }
`

export const ProductGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding-right: 8px;
  flex: 1;
  align-content: start;
  grid-auto-rows: min-content;

  &::webkitscrollbar {
    width: 6px;
  }

  &::webkitscrollbarthumb {
    background: var(--mantine-color-gray-4);
    border-radius: 3px;
  }

  &::webkitscrollbartrack {
    background: var(--mantine-color-gray-1);
  }

  @media (prefers-color-scheme: dark) {
    &::webkitscrollbarthumb {
      background: var(--mantine-color-dark-4);
    }

    &::webkitscrollbartrack {
      background: var(--mantine-color-dark-6);
    }
  }
`

export const ProductCard = styled(Card)`
  cursor: pointer;
  transition: all 0.2s ease;
  height: fit-content;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--mantine-shadow-md);
  }

  &:active {
    transform: translateY(0);
  }
`

export const ProductImage = styled.div`
  width: 100%;
  height: 80px;
  background: var(--mantine-color-gray-1);
  border-radius: var(--mantine-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin-bottom: 8px;

  @media (prefers-color-scheme: dark) {
    background: var(--mantine-color-dark-6);
  }
`

export const SmallInput = styled.input`
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--mantine-color-gray-3);
  border-radius: var(--mantine-radius-sm);
  font-size: 12px;
  outline: none;
  background: var(--mantine-color-white);
  color: var(--mantine-color-black);
  transition: border-color 0.2s ease;

  &:focus {
    border-color: var(--mantine-primary-color-filled);
  }

  &:hover {
    border-color: var(--mantine-color-gray-4);
  }

  @media (prefers-color-scheme: dark) {
    background: var(--mantine-color-dark-6);
    color: var(--mantine-color-white);
    border-color: var(--mantine-color-dark-4);

    &:hover {
      border-color: var(--mantine-color-dark-3);
    }
  }
`

export const Divider = styled.div`
  height: 1px;
  background: var(--mantine-color-gray-3);
  margin: 12px 0;

  @media (prefers-color-scheme: dark) {
    background: var(--mantine-color-dark-4);
  }
`

export const FlexRow = styled.div<{ $justify?: string; $align?: string }>`
  display: flex;
  justify-content: ${(props) => props.$justify || 'flex-start'};
  align-items: ${(props) => props.$align || 'center'};
  gap: 8px;
`

export const FlexColumn = styled.div<{ $gap?: string }>`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.$gap || '8px'};
`

export const ScrollContainer = styled.div`
  overflow-y: auto;
  flex: 1;

  &::webkitscrollbar {
    width: 6px;
  }

  &::webkitscrollbarthumb {
    background: var(--mantine-color-gray-4);
    border-radius: 3px;
  }

  &::webkitscrollbartrack {
    background: var(--mantine-color-gray-1);
  }

  @media (prefers-color-scheme: dark) {
    &::webkitscrollbarthumb {
      background: var(--mantine-color-dark-4);
    }

    &::webkitscrollbartrack {
      background: var(--mantine-color-dark-6);
    }
  }
`

export const TruncatedText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  @media (prefers-color-scheme: dark) {
    background: rgba(0, 0, 0, 0.8);
  }
`

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--mantine-color-gray-6);

  svg {
    margin-bottom: 16px;
    opacity: 0.5;
  }

  @media (prefers-color-scheme: dark) {
    color: var(--mantine-color-dark-3);
  }
`

export const MobileHidden = styled.div`
  @media (max-width: 768px) {
    display: none;
  }
`

export const DesktopHidden = styled.div`
  @media (min-width: 769px) {
    display: none;
  }
`

