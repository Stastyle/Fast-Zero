import { createHashRouter, RouterProvider } from 'react-router-dom'
import { HomeScreen } from './screens/HomeScreen'
import { ProfileSelectScreen } from './screens/ProfileSelectScreen'
import { ProfileEditScreen } from './screens/ProfileEditScreen'
import { TargetInputScreen } from './screens/TargetInputScreen'
import { CalibrateScreen } from './screens/CalibrateScreen'
import { TapHitsScreen } from './screens/TapHitsScreen'
import { ResultScreen } from './screens/ResultScreen'
import { HistoryScreen } from './screens/HistoryScreen'

const router = createHashRouter([
  { path: '/', element: <HomeScreen /> },
  { path: '/profiles', element: <ProfileSelectScreen /> },
  { path: '/profiles/new', element: <ProfileEditScreen /> },
  { path: '/profiles/:id/edit', element: <ProfileEditScreen /> },
  { path: '/target', element: <TargetInputScreen /> },
  { path: '/calibrate', element: <CalibrateScreen /> },
  { path: '/hits', element: <TapHitsScreen /> },
  { path: '/result', element: <ResultScreen /> },
  { path: '/history', element: <HistoryScreen /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
