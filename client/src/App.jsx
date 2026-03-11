import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'
import WorkOrders from './pages/WorkOrders'
import WorkRequests from './pages/WorkRequests'
import Inventory from './pages/Inventory'
import Vendors from './pages/Vendors'
import Reports from './pages/Reports'
import Predictive from './pages/Predictive'
import ControlPanel from './pages/ControlPanel'
import Users from './pages/Users'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/control-panel" element={<ControlPanel />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/work-requests" element={<WorkRequests />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/predictive" element={<Predictive />} />
          <Route path="/users" element={<Users />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
