import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core'
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router'
import { provideHttpClient, withFetch } from '@angular/common/http'
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field'
import {
  BUILDER_CONFIG,
  provideProjectRepository,
} from './core/persistence/project-repository'
import { environment } from '../environments/environment'
import { routes } from './app.routes'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
      // Cross-fade between routes; skipped automatically when reduced motion is requested.
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition }) => {
          if (matchMedia('(prefers-reduced-motion: reduce)').matches)
            transition.skipTransition()
        },
      }),
    ),
    provideHttpClient(withFetch()),
    {
      provide: BUILDER_CONFIG,
      useValue: { apiBaseUrl: environment.apiBaseUrl },
    },
    provideProjectRepository(),
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
  ],
}
