import { DashboardLayout as Layout } from '@layout/dashboard'
import { ProductsManagement as Feature } from '@features/itemsMaster'
const ProductsManagement = () => {
  return (
    <Layout>
      <Feature />
    </Layout>
  )
}

const ROUTE = {
  path: '/items-master/products',
  name: 'Products Management',
  protected: true,
}

export { ProductsManagement, ROUTE }

