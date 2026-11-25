import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import Setup from './pages/Setup'
import ProtectedRoute from './routes/ProtectedRoute'
import GuestRoute from './routes/GuestRoute'
import ProfileRoute from './routes/ProfileRoute'
import SetupRoute from './routes/SetupRoute'
import Booking from './pages/Booking'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import Services from './pages/Dashboard/Services'
import WorkingHours from './pages/Dashboard/WorkingHours'
import Agenda from './pages/Dashboard/Agenda'
import Customers from './pages/Dashboard/Customers'
import Finance from './pages/Dashboard/Finance'

import { Routes, Route } from 'react-router-dom'

function App() {
  return (
    <Routes>
      <Route path='/' element={<GuestRoute><LandingPage /></GuestRoute>} />
      <Route path='/register' element={<GuestRoute> <Register /> </GuestRoute>} />
      <Route path='/login' element={<GuestRoute> <Login /> </GuestRoute>} />
      <Route path='/book/:slug' element={<Booking />} />
      <Route path='/setup' element={<ProtectedRoute><SetupRoute><Setup /></SetupRoute></ProtectedRoute>} />
      <Route path='/dashboard' element={<ProtectedRoute><ProfileRoute><DashboardLayout><Dashboard /></DashboardLayout></ProfileRoute></ProtectedRoute>} />
      <Route path='/dashboard/services' element={<ProtectedRoute><ProfileRoute><DashboardLayout><Services /></DashboardLayout></ProfileRoute></ProtectedRoute>} />
      <Route path='/dashboard/working-hours' element={<ProtectedRoute><ProfileRoute><DashboardLayout><WorkingHours /></DashboardLayout></ProfileRoute></ProtectedRoute>} />
      <Route path='/dashboard/agenda' element={<ProtectedRoute><ProfileRoute><DashboardLayout><Agenda /></DashboardLayout></ProfileRoute></ProtectedRoute>} />
      <Route path='/dashboard/customers' element={<ProtectedRoute><ProfileRoute><DashboardLayout><Customers /></DashboardLayout></ProfileRoute></ProtectedRoute>} />
      <Route path='/dashboard/finance' element={<ProtectedRoute><ProfileRoute><DashboardLayout><Finance /></DashboardLayout></ProfileRoute></ProtectedRoute>} />
    </Routes>
  )
}
export default App
