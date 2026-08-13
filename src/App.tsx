import { createHashRouter, Outlet, RouterProvider, useRouteError } from 'react-router-dom'
import { he } from './i18n/he'
import { appVersion } from './version'
import { HomeScreen } from './screens/HomeScreen'
import { ProfileSelectScreen } from './screens/ProfileSelectScreen'
import { ProfileEditScreen } from './screens/ProfileEditScreen'
import { TargetInputScreen } from './screens/TargetInputScreen'
import { CameraCaptureScreen } from './screens/CameraCaptureScreen'
import { CornersScreen } from './screens/CornersScreen'
import { AimPointScreen } from './screens/AimPointScreen'
import { CalibrateScreen } from './screens/CalibrateScreen'
import { TapHitsScreen } from './screens/TapHitsScreen'
import { ResultScreen } from './screens/ResultScreen'
import { HistoryScreen } from './screens/HistoryScreen'

/** A crash must never look like "the button did nothing" — surface it. */
function ErrorScreen() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="screen">
      <div className="screen-body">
        <h1 style={{ fontSize: 'var(--text-xl)' }}>{he.appError.title}</h1>
        <p className="hint" dir="ltr">
          {message}
        </p>
        <button
          type="button"
          className="big-button"
          onClick={() => {
            window.location.hash = '#/'
            window.location.reload()
          }}
        >
          {he.appError.reload}
        </button>
      </div>
    </div>
  )
}

function Layout() {
  return (
    <div className="app-shell">
      <Outlet />
      <footer className="app-footer">
        {he.footer}
        {' | '}
        <span dir="ltr">{appVersion}</span>
      </footer>
    </div>
  )
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorScreen />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'profiles', element: <ProfileSelectScreen /> },
      { path: 'profiles/new', element: <ProfileEditScreen /> },
      { path: 'profiles/:id/edit', element: <ProfileEditScreen /> },
      { path: 'target', element: <TargetInputScreen /> },
      { path: 'camera', element: <CameraCaptureScreen /> },
      { path: 'corners', element: <CornersScreen /> },
      { path: 'aim', element: <AimPointScreen /> },
      { path: 'calibrate', element: <CalibrateScreen /> },
      { path: 'hits', element: <TapHitsScreen /> },
      { path: 'result', element: <ResultScreen /> },
      { path: 'history', element: <HistoryScreen /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
