import { ApplicationConfig, inject } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
  HttpErrorResponse,
} from '@angular/common/http';
import { routes } from './app.routes';
import { catchError, throwError } from 'rxjs';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    provideHttpClient(
      withInterceptors([
        (req, next) => {
          const router = inject(Router);

          const token = localStorage.getItem('token');

          const authReq = token
            ? req.clone({
                setHeaders: {
                  Authorization: `Bearer ${token}`,
                },
              })
            : req;

          return next(authReq).pipe(
            catchError((error: HttpErrorResponse) => {
              if (error.status === 401 || error.status === 403) {
                localStorage.clear();
                router.navigate(['/login']);
              }
              return throwError(() => error);
            })
          );
        },
      ])
    ),
  ],
};
