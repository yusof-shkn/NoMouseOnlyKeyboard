import { DashboardLayout as Layout } from '@layout/dashboard'
import { CategoriesManagement as Feature } from '@features/itemsMaster'
const CategoriesManagement = () => {
  return (
    <Layout>
      <Feature />
    </Layout>
  )
}

const ROUTE = {
  path: '/items-master/products/categories',
  name: 'CategoriesManagement',
  protected: true,
}

export { CategoriesManagement, ROUTE }

