import { Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'
import WorkOrders from './pages/WorkOrders'
import Inventory from './pages/Inventory'
import Vendors from './pages/Vendors'
import Reports from './pages/Reports'
import Predictive from './pages/Predictive'
import ControlPanel from './pages/ControlPanel'

export default function App() {
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
      </Route>
    </Routes>
  )
}
