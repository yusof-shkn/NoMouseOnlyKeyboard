import { AppShell } from '@mantine/core'
import Navbar from '@layout/dashboard/components/navbar/navbar'
import { PurchasePOP as Feature } from '@features/purchase/components/POP/PurchasePOP'
import { GenericModal } from '@shared/components/genericModal/GenericModal'

const PurchasePOP = () => {
  return (
    <AppShell header={{ height: 56 ,        border: '1rem solid red',
    }}>
      <GenericModal />
      <Navbar />
      <AppShell.Main
        style={{
          height: 'calc(100vh - 56px)',
          overflow: 'hidden',
          padding: 0,
          paddingTop: 0,
          marginTop: 56,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Feature />
      </AppShell.Main>
    </AppShell>
  )
}

const ROUTE = {
  path: '/purchases/pop',
  name: 'PurchasePOP',
  protected: true,
}

export { PurchasePOP, ROUTE }
