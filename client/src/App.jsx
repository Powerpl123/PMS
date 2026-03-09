import { Routes, Route } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Layout from './Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'
import WorkOrders from './pages/WorkOrders'
import Inventory from './pages/Inventory'
import Vendors from './pages/Vendors'
import Reports from './pages/Reports'
import Predictive from './pages/Predictive'
import ControlPanel from './pages/ControlPanel'
import UserManagement from './pages/UserManagement'

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading" style={{ marginTop: '40vh' }}>Loading...</div>;
  if (!user) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/control-panel" element={<ControlPanel />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/work-orders" element={<WorkOrders />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/predictive" element={<Predictive />} />
        <Route path="/users" element={<UserManagement />} />
      </Route>
    </Routes>
  )
}
