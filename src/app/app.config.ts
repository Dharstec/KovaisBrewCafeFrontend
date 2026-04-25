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
                let shopId: string | null = null;
                if (typeof window !== 'undefined') {
                    token = localStorage.getItem('token');
                    shopId = localStorage.getItem('shop_id');
                }
                const headers: Record<string, string> = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                if (shopId) headers['X-Shop-Id'] = shopId;

                const authReq = Object.keys(headers).length
                    ? req.clone({ setHeaders: headers })
                    : req;
                return next(authReq).pipe(catchError((error: HttpErrorResponse) => {
                    if (error.status === 401) {
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
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
        }),
        provideCharts(withDefaultRegisterables()) // ✅ REQUIRED

    ],
};
