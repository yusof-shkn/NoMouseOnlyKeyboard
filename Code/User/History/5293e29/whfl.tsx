import { createBrowserRouter, Navigate } from 'react-router-dom'

// Customer pages
import Login from './pages/customer/Login'
import Register from './pages/customer/Register'
import ForgotPassword from './pages/customer/ForgotPassword'
import Dashboard from './pages/customer/Dashboard'
import FamilyProfiles from './pages/customer/FamilyProfiles'
import AddProfile from './pages/customer/AddProfile'
import ProfilePage from './pages/customer/ProfilePage'
import PersonalInformationPage from './pages/customer/PersonalInformationPage'
import InsuranceManagementPage from './pages/customer/InsuranceManagementPage'
import UploadPrescription from './pages/customer/UploadPrescription'
import OrderTracking from './pages/customer/OrderTracking'
import OrderBreakdown from './pages/customer/OrderBreakdown'
import Payment from './pages/customer/Payment'
import DeliveryTracking from './pages/customer/DeliveryTracking'
import OrderHistory from './pages/customer/OrderHistory'
import Notifications from './pages/customer/Notifications'

// Pharmacy pages
import PharmacyLogin from './pages/pharmacy/PharmacyLogin'
import PharmacyDashboard from './pages/pharmacy/PharmacyDashboard'
import PharmacyOrderDetail from './pages/pharmacy/PharmacyOrderDetail'
import UserManagement from './pages/pharmacy/UserManagement'
import InsuranceManagement from './pages/pharmacy/InsuranceManagement'
import InsuranceReview from './pages/pharmacy/InsuranceReview'
import CustomerManagement from './pages/pharmacy/CustomerManagement'
import RiderManagement from './pages/pharmacy/RiderManagement'
import RiderProfile from './pages/pharmacy/RiderProfile'
import PharmacyCustomerProfile from './pages/pharmacy/PharmacyCustomerProfile'
import MarketingPage from './pages/pharmacy/MarketingPage'
import PharmacyAlerts from './pages/pharmacy/PharmacyAlerts'
import PharmacyAlertsOrders from './pages/pharmacy/PharmacyAlertsOrders'
import PharmacyAlertsChronic from './pages/pharmacy/PharmacyAlertsChronic'
import PharmacyAlertsMessages from './pages/pharmacy/PharmacyAlertsMessages'

// Insurance pages
import InsuranceLogin from './pages/insurance/InsuranceLogin'
import {
  InsuranceVerificationsList,
  InsuranceVerificationDetail,
} from './pages/insurance/InsuranceVerifications'
import InsuranceOrders from './pages/insurance/InsuranceOrders'
import InsuranceCustomers from './pages/insurance/InsuranceCustomers'
import InsuranceCustomerProfile from './pages/insurance/InsuranceCustomerProfile'
import InsuranceOrderDetail from './pages/insurance/InsuranceOrderDetail'
import InsuranceSchemes from './pages/insurance/InsuranceSchemes'
import InsuranceApprovals from './pages/insurance/InsuranceApprovals'
import InsuranceAlertsMessages from './pages/insurance/InsuranceAlertsMessages'
import InsuranceAlertsExpiring from './pages/insurance/InsuranceAlertsExpiring'

// Staff account (shared across portals)
import StaffAccount from './pages/staff/StaffAccount'

// Delivery pages
import DeliveryLogin from './pages/delivery/DeliveryLogin'
import DeliveryDashboard from './pages/delivery/DeliveryDashboard'
import DeliveryHistory from './pages/delivery/DeliveryHistory'
import DeliveryScan from './pages/delivery/DeliveryScan'

// Layouts
import { RootLayout } from './layouts/RootLayout'
import { CustomerLayout } from './layouts/CustomerLayout'
import { PharmacyLayout } from './layouts/PharmacyLayout'
import { InsuranceLayout } from './layouts/InsuranceLayout'
import { DeliveryLayout } from './layouts/DeliveryLayout'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: Login },
      { path: 'login', Component: Login },
      { path: 'register', Component: Register },
      { path: 'forgot-password', Component: ForgotPassword },
      {
        Component: CustomerLayout,
        children: [
          { path: 'dashboard', Component: Dashboard },
          { path: 'profile', Component: ProfilePage },
          { path: 'family-profiles', Component: FamilyProfiles },
          { path: 'add-profile', Component: AddProfile },
          { path: 'personal-info', Component: PersonalInformationPage },
          { path: 'insurance-management', Component: InsuranceManagementPage },
          { path: 'upload-prescription', Component: UploadPrescription },
          { path: 'notifications', Component: Notifications },
          { path: 'order/:id', Component: OrderTracking },
          { path: 'order/:id/breakdown', Component: OrderBreakdown },
          { path: 'order/:id/payment', Component: Payment },
          { path: 'order/:id/delivery', Component: DeliveryTracking },
          { path: 'order-history', Component: OrderHistory },
        ],
      },
    ],
  },
  {
    path: '/pharmacy',
    Component: PharmacyLayout,
    children: [
      { index: true, Component: PharmacyLogin },
      { path: 'login', Component: PharmacyLogin },
      { path: 'dashboard', Component: PharmacyDashboard },
      { path: 'order/:id', Component: PharmacyOrderDetail },
      { path: 'users', Component: UserManagement },
      { path: 'insurance', Component: InsuranceManagement },
      { path: 'insurance/:profileId', Component: InsuranceReview },
      { path: 'customers', Component: CustomerManagement },
      { path: 'customer/:userId', Component: PharmacyCustomerProfile },
      { path: 'riders', Component: RiderManagement },
      { path: 'riders/:id', Component: RiderProfile },
      { path: 'marketing', Component: MarketingPage },
      {
        path: 'alerts',
        element: (
          <Navigate
            to="/pharmacy/alerts/orders"
            replace
          />
        ),
      },
      { path: 'alerts/orders', Component: PharmacyAlertsOrders },
      { path: 'alerts/chronic', Component: PharmacyAlertsChronic },
      { path: 'alerts/messages', Component: PharmacyAlertsMessages },
      { path: 'account', element: <StaffAccount portal="pharmacy" /> },
    ],
  },
  {
    path: '/insurance',
    Component: InsuranceLayout,
    children: [
      { index: true, Component: InsuranceLogin },
      { path: 'login', Component: InsuranceLogin },
      // /insurance/dashboard redirects to orders — dashboard is embedded in orders via tabs
      {
        path: 'dashboard',
        element: (
          <Navigate
            to="/insurance/orders"
            replace
          />
        ),
      },
      { path: 'verifications', Component: InsuranceVerificationsList },
      { path: 'verifications/:id', Component: InsuranceVerificationDetail },
      { path: 'orders', Component: InsuranceOrders },
      { path: 'orders/:id', Component: InsuranceOrderDetail },
      { path: 'customers', Component: InsuranceCustomers },
      { path: 'customer/:userId', Component: InsuranceCustomerProfile },
      { path: 'schemes', Component: InsuranceSchemes },
      { path: 'approvals', Component: InsuranceApprovals },
      {
        path: 'alerts',
        element: (
          <Navigate
            to="/insurance/alerts/messages"
            replace
          />
        ),
      },
      { path: 'alerts/messages', Component: InsuranceAlertsMessages },
      { path: 'alerts/expiring', Component: InsuranceAlertsExpiring },
      { path: 'account', element: <StaffAccount portal="insurance" /> },
    ],
  },
  {
    path: '/delivery',
    Component: DeliveryLayout,
    children: [
      { index: true, Component: DeliveryLogin },
      { path: 'login', Component: DeliveryLogin },
      { path: 'dashboard', Component: DeliveryDashboard },
      { path: 'history', Component: DeliveryHistory },
      { path: 'scan/:id', Component: DeliveryScan },
      { path: 'account', element: <StaffAccount portal="delivery" /> },
    ],
  },
])

