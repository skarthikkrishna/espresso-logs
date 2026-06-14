import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { router } from './router'
import KaapiAmbientLayer from './components/motion/KaapiAmbientLayer'

export default function App() {
  return (
    <AuthProvider>
      {/* spec-043 T006: mounted once here so the shared ambient never remounts on
          route change (single persistent WebGL context). */}
      <KaapiAmbientLayer />
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
