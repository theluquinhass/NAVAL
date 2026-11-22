import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import Checkout from './pages/Checkout'
import Login from './pages/Login'
import Register from './pages/Register'
import Setup from './pages/Setup'
import ProtectedRoute from './routes/ProtectedRoute'
import GuestRoute from './routes/GuestRoute'
import ProfileRoute from './routes/ProfileRoute'

import { Routes, Route } from 'react-router-dom'

function App() {
  return (
    <Routes>
      <Route path='/' element={<LandingPage />} />
      <Route path='/register' element={<GuestRoute> <Register /> </GuestRoute>} />
      <Route path='/login' element={<GuestRoute> <Login /> </GuestRoute>} />
      <Route path='/checkout' element={<Checkout />} />
      <Route path='/setup' element={ <ProtectedRoute> <Setup/> </ProtectedRoute> }/>
      <Route path='/dashboard' element={<ProtectedRoute><ProfileRoute><Dashboard /></ProfileRoute></ProtectedRoute>} />
    </Routes>
  )
}
export default App
