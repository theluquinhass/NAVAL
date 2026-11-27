import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Register from './pages/Register'
import Setup from './pages/Setup'
import Booking from './pages/Booking'
import ProtectedRoute from './routes/ProtectedRoute'
import GuestRoute from './routes/GuestRoute'
import ProfileRoute from './routes/ProfileRoute'
import SetupRoute from './routes/SetupRoute'
import ProductsRoute from './routes/ProductsRoute'
import DashboardLayout from './components/layout/DashboardLayout.jsx'

const Services = lazy(() => import('./pages/Dashboard/Services'))
const WorkingHours = lazy(() => import('./pages/Dashboard/WorkingHours'))
const Agenda = lazy(() => import('./pages/Dashboard/Agenda'))
const Customers = lazy(() => import('./pages/Dashboard/Customers'))
const Finance = lazy(() => import('./pages/Dashboard/Finance'))
const Products = lazy(() => import('./pages/Dashboard/Products'))
const ProductsMovements = lazy(() => import('./pages/Dashboard/Products/Movements'))
const ProductsFinance = lazy(() => import('./pages/Dashboard/Products/Finance'))
const Settings = lazy(() => import('./pages/Dashboard/Settings'))

function App() {
    return (
        <Routes>
            <Route path='/' element={<GuestRoute><LandingPage /></GuestRoute>} />
            <Route path='/register' element={<GuestRoute> <Register /> </GuestRoute>} />
            <Route path='/login' element={<GuestRoute> <Login /> </GuestRoute>} />
            <Route path='/book/:slug' element={<Booking />} />
            <Route path='/setup' element={<ProtectedRoute><SetupRoute><Setup /></SetupRoute></ProtectedRoute>} />
            <Route path='/dashboard' element={<ProtectedRoute><ProfileRoute><DashboardLayout /></ProfileRoute></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path='services' element={<Services />} />
                <Route path='working-hours' element={<WorkingHours />} />
                <Route path='agenda' element={<Agenda />} />
                <Route path='customers' element={<Customers />} />
                <Route path='finance' element={<Finance />} />
                <Route path='products' element={<ProductsRoute><Products /></ProductsRoute>} />
                <Route path='products/movements' element={<ProductsRoute><ProductsMovements /></ProductsRoute>} />
                <Route path='products/finance' element={<ProductsRoute><ProductsFinance /></ProductsRoute>} />
                <Route path='business' element={<Settings />} />
                <Route path='settings' element={<Settings />} />
            </Route>
        </Routes>
    )
}
export default App
