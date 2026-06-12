import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getAppShellBackgroundToken } from '../utils/householdBackgrounds'


export default function AppShell() {
  const location = useLocation()
  const [animating, setAnimating] = useState(false)
  const prevPathname = useRef(location.pathname)

  const bgClass = useMemo(() => getAppShellBackgroundToken(location.pathname), [location.pathname])

  // Scroll content to top on route change
  useEffect(() => {
    document.getElementById('main-content')?.scrollTo(0, 0)
  }, [location.pathname])

  // Trigger fade-in via CSS class toggle — no DOM unmount, no blank frame
  useEffect(() => {
    if (prevPathname.current !== location.pathname) {
      prevPathname.current = location.pathname
      setAnimating(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true))
      })
    } else {
      setAnimating(true)
    }
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden" style={{ isolation: 'isolate' }}>
      {/* Fixed background image — changes per route */}
      <div className={`app-bg ${bgClass}`} aria-hidden="true" />

      {/* Sidebar — desktop only, NEVER unmounts */}
      <Sidebar />

      {/* Main content area — frosted glass panel */}
      <main
        id="main-content"
        className="flex-1 overflow-y-auto pb-[var(--mobile-content-bottom-padding)] lg:pb-0"
      >
        {/* Page content — class-toggled animation, DOM node never unmounts */}
        <div className={`page-content min-h-full ${animating ? 'page-enter' : ''}`}>
          <Outlet />
        </div>
      </main>

      {/* Bottom nav — mobile only, NEVER unmounts */}
      <BottomNav />
    </div>
  )
}
