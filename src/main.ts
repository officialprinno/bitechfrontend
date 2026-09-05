import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';
import { captureHotspotContext } from './app/core/portal/hotspot-context';

captureHotspotContext();
bootstrapApplication(App, appConfig)
  .then(() => {
    // D20: baseline SW for static assets only — no install prompts
    if (environment.production && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  })
  .catch((err) => console.error(err));
