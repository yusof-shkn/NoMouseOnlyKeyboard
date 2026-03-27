import { DashboardLayout as Layout } from '@layout/dashboard'
import { SalesPOSHistory as Feature } from '@features/sales/components/salesHistory/SalesHistory'
const SalesPosHistory = () => {
  return (
    <Layout>
      <Feature />
    </Layout>
  )
}

const ROUTE = {
  path: '/sales/orders',
  name: 'SalesPosHistory',
  protected: true,
}

export { SalesPosHistory, ROUTE }

