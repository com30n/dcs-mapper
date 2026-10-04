import { createHashRouter, redirect } from 'react-router'
import { AircraftScreen } from '../features/aircraft/AircraftScreen'
import { DevicesScreen } from '../features/devices/DevicesScreen'
import { ExportScreen } from '../features/export/ExportScreen'
import { MapScreen } from '../features/map/MapScreen'
import { Layout } from './Layout'
import { requireStep } from './steps'

export const makeRouter = () => createHashRouter([
  {
    path: '/',
    element: <Layout />,
    hydrateFallbackElement: null,
    children: [
      { index: true, element: <AircraftScreen /> },
      { path: 'devices', loader: requireStep('devices'), element: <DevicesScreen /> },
      { path: 'map', loader: requireStep('map'), element: <MapScreen /> },
      { path: 'export', loader: requireStep('export'), element: <ExportScreen /> },
      { path: '*', loader: () => redirect('/') },
    ],
  },
])
