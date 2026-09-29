import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PortalAccessGate } from '@/components/auth/PortalAccessGate'

import { LoginPage } from '@/pages/LoginPage'

import { DashboardPage } from '@/pages/DashboardPage'

import { EnquiriesPage } from '@/pages/EnquiriesPage'

import { CreateEnquiryPage } from '@/pages/CreateEnquiryPage'
import { ClientsPage } from '@/pages/ClientsPage'

import { EnquiryDetailPage } from '@/pages/EnquiryDetailPage'
import { ExcelImportPage } from '@/pages/ExcelImportPage'

import { OrdersPage } from '@/pages/OrdersPage'

import { OrderDetailPage } from '@/pages/OrderDetailPage'

import { CreateDispatchPage } from '@/pages/CreateDispatchPage'

import { VehicleDetailsPage } from '@/pages/VehicleDetailsPage'

import { DispatchPreviewPage } from '@/pages/DispatchPreviewPage'

import { DispatchConfirmPage } from '@/pages/DispatchConfirmPage'

import { DispatchDetailPage } from '@/pages/DispatchDetailPage'

import { DispatchListPage } from '@/pages/DispatchListPage'

import { SettingsPage } from '@/pages/SettingsPage'

import { isApiMode } from '@/lib/api'
import { NotificationProvider } from '@/components/notifications/NotificationProvider'

import { MobileLayout } from '@/mobile/layout/MobileLayout'

import { MobileLoginPage } from '@/mobile/pages/MobileLoginPage'

import { MobileOrdersPage } from '@/mobile/pages/MobileOrdersPage'

import { MobileOrderPage } from '@/mobile/pages/MobileOrderPage'

import { MobileCreateDispatchPage } from '@/mobile/pages/MobileCreateDispatchPage'

import { MobileVehiclePage } from '@/mobile/pages/MobileVehiclePage'

import { MobileDispatchPreviewPage } from '@/mobile/pages/MobileDispatchPreviewPage'

import { MobileDispatchConfirmPage } from '@/mobile/pages/MobileDispatchConfirmPage'

import { MobileDispatchListPage } from '@/mobile/pages/MobileDispatchListPage'

import { MobileDispatchDetailPage } from '@/mobile/pages/MobileDispatchDetailPage'



const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined



export default function App() {

  return (

    <BrowserRouter basename={basename}>
      <NotificationProvider>
      <Routes>

        <Route path="/login" element={<LoginPage />} />

        <Route path="/m/login" element={<MobileLoginPage />} />

        <Route element={<ProtectedRoute loginPath="/m/login" />}>

          <Route path="/m" element={<MobileLayout />}>

            <Route index element={<Navigate to="/m/orders" replace />} />

            <Route path="orders" element={<MobileOrdersPage />} />

            <Route path="orders/:id" element={<MobileOrderPage />} />

            <Route path="orders/:id/dispatch" element={<MobileCreateDispatchPage />} />

            <Route path="orders/:id/vehicle" element={<MobileVehiclePage />} />

            <Route path="orders/:id/preview" element={<MobileDispatchPreviewPage />} />

            <Route path="dispatches" element={<MobileDispatchListPage />} />

            <Route path="dispatches/:id" element={<MobileDispatchDetailPage />} />

            <Route path="dispatches/:id/confirm" element={<MobileDispatchConfirmPage />} />

          </Route>

        </Route>

        <Route element={<ProtectedRoute desktopOnly />}>

          <Route element={<PortalAccessGate />}>
          <Route element={<AppLayout />}>

            <Route path="/" element={<DashboardPage />} />

            <Route path="/clients" element={<ClientsPage />} />

            <Route path="/enquiries" element={<EnquiriesPage />} />

            <Route path="/enquiries/new" element={<CreateEnquiryPage />} />

            <Route path="/enquiries/:id" element={<EnquiryDetailPage />} />

            <Route path="/enquiries/:id/design/import" element={<ExcelImportPage />} />

            <Route path="/orders" element={<OrdersPage />} />

            <Route path="/orders/:id" element={<OrderDetailPage />} />

            <Route path="/orders/:id/dispatch" element={<CreateDispatchPage />} />

            <Route path="/orders/:id/dispatch/vehicle" element={<VehicleDetailsPage />} />

            <Route path="/orders/:id/dispatch/preview" element={<DispatchPreviewPage />} />

            <Route path="/dispatch" element={<DispatchListPage />} />

            <Route path="/dispatch/:id" element={<DispatchDetailPage />} />

            <Route path="/dispatch/:id/confirm" element={<DispatchConfirmPage />} />

            <Route path="/settings" element={<SettingsPage />} />

          </Route>
          </Route>

        </Route>

        <Route path="*" element={<Navigate to={isApiMode ? '/login' : '/'} replace />} />

      </Routes>
      </NotificationProvider>
    </BrowserRouter>

  )

}


