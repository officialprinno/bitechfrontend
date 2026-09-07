import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionReviewComponent } from './core/auth/session-review.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SessionReviewComponent],
  template: `<router-outlet /><app-session-review />`,
})
export class App {}
