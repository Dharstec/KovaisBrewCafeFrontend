import { ApplicationConfig, inject, isDevMode } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import {
    provideHttpClient,
    withInterceptors,
    HttpErrorResponse,
} from '@angular/common/http';
import { routes } from './app.routes';
import { catchError, throwError } from 'rxjs';
import { provideServiceWorker } from '@angular/service-worker';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([
            (req, next) => {
                const router = inject(Router);
                let token: string | null = null;
                // ✅ SAFE localStorage access
                if (typeof window !== 'undefined') {
                    token = localStorage.getItem('token');
                }
                const authReq = token
                    ? req.clone({
                        setHeaders: {
                            Authorization: `Bearer ${token}`,
                        },
                    })
                    : req;
                return next(authReq).pipe(catchError((error: HttpErrorResponse) => {
                    if (error.status === 401 || error.status === 403) {
                        if (typeof window !== 'undefined') {
                            localStorage.clear();
                        }
                        router.navigate(['/login']);
                    }
                    return throwError(() => error);
                }));
            },
        ])),
        provideServiceWorker('ngsw-worker.js', {
            enabled: true, // TEMPORARY force enable
            registrationStrategy: 'registerWhenStable:30000'
        }),
        provideCharts(withDefaultRegisterables()) // ✅ REQUIRED

    ],
};
