import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-session-review',
  standalone: true,
  template: `@if (auth.sessionLocked()) {
    <dialog #modal aria-labelledby="session-title" aria-describedby="session-description" (cancel)="$event.preventDefault()">
      <p class="eyebrow">BITECH · SESSION</p>
      <h2 id="session-title">Unataka kuendelea?</h2>
      <p id="session-description">Saa moja imepita. Chagua kuendelea kutumia mfumo kwa saa nyingine au kutoka kwenye akaunti yako.</p>
      <p class="note">Mfumo umesitishwa kusubiri chaguo lako.</p>
      @if (auth.sessionError()) { <p role="alert" class="error">{{ auth.sessionError() }}</p> }
      <div class="actions">
        <button type="button" [disabled]="auth.continuing()" (click)="auth.logout()">Toka / Logout</button>
        <button type="button" autofocus class="primary" [disabled]="auth.continuing()" (click)="auth.continueSession()">{{ auth.continuing() ? 'Inaendelea…' : 'Endelea kutumia mfumo' }}</button>
      </div>
    </dialog>
  }`,
  styles: [`
    dialog { width: min(480px, calc(100vw - 32px)); margin: auto; padding: 28px; border: 1px solid var(--border-subtle, #ddd); border-radius: 20px; background: var(--surface-1, white); color: var(--text-primary, #172033); box-shadow: 0 24px 80px #0004; }
    dialog::backdrop { background: #0f172acc; backdrop-filter: blur(5px); }
    .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .12em; color: var(--brand-signal, #2563eb); }
    h2 { font-size: 24px; font-weight: 700; margin: 12px 0; }
    p { line-height: 1.65; } .note { margin-top: 12px; font-size: 13px; color: var(--text-secondary, #64748b); }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
    button { flex: 1; min-height: 46px; padding: 10px 16px; border: 1px solid var(--border-subtle, #ddd); border-radius: 10px; font-weight: 600; cursor: pointer; }
    .primary { background: var(--brand-signal, #2563eb); color: white; border-color: transparent; }
    button:disabled { opacity: .6; cursor: wait; } button:focus-visible { outline: 3px solid #60a5fa; outline-offset: 3px; }
    .error { color: #dc2626; margin-top: 12px; }
  `],
})
export class SessionReviewComponent {
  readonly auth = inject(AuthService);
  @ViewChild('modal') set modal(element: ElementRef<HTMLDialogElement> | undefined) {
    if (element && !element.nativeElement.open) element.nativeElement.showModal();
  }
}
