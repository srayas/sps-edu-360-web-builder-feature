import { Routes } from '@angular/router'
import { MainLayout } from './layout/main-layout'

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: '',
        title: 'spsEdu360 Web Builder',
        loadComponent: () => import('./features/site/home').then((m) => m.Home),
      },
      {
        path: 'projects',
        title: 'Projects · spsEdu360',
        loadComponent: () =>
          import('./features/projects/projects').then((m) => m.Projects),
      },
    ],
  },
  { path: 'site', redirectTo: '', pathMatch: 'full' },
  {
    path: 'builder/:id',
    loadComponent: () =>
      import('./features/studio/studio').then((m) => m.Studio),
  },
  {
    path: 'app/:id',
    loadComponent: () =>
      import('./features/viewer/viewer').then((m) => m.Viewer),
  },
  {
    path: 'app/:id/:slug',
    loadComponent: () =>
      import('./features/viewer/viewer').then((m) => m.Viewer),
  },
  {
    path: '**',
    title: 'Not found',
    loadComponent: () =>
      import('./features/site/not-found').then((m) => m.NotFound),
  },
]
