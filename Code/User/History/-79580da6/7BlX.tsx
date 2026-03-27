import { DashboardLayout as Layout } from '@layout/dashboard'
import { UnitsManagement as Feature } from '@features/itemsMaster'
const UnitsManagement = () => {
  return (
    <Layout>
      <Feature />
    </Layout>
  )
}

const ROUTE = {
  path: '/items-master/products/units',
  name: 'UnitsManagement',
  protected: true,
}

export { UnitsManagement, ROUTE }


