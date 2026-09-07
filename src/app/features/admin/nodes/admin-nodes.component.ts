import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { AuthService } from '../../../core/auth/auth.service';
import { AppError } from '../../../core/models/app-error';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface NodeRow {
  id: string;
  site: string;
  site_name: string;
  node_identifier: string;
  display_name: string;
  mikrotik_host: string;
  api_port: number;
  use_ssl: boolean;
  is_active: boolean;
  health_status: 'online' | 'offline' | 'unknown';
  last_health_check_at: string | null;
  remote_management?: { permitted: boolean; available: boolean };
}

interface TestResult {
  ok: boolean;
  detail: string;
  health_status: NodeRow['health_status'];
  last_health_check_at: string;
}

@Component({
  selector: 'app-admin-nodes',
  standalone: true,
  styles: [`
    button { transition: background-color .15s, opacity .15s; }
    button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--color-signal, #2563eb); outline-offset: 3px; }
    tbody tr:hover { background: var(--surface-0); }
    @media (max-width: 640px) {
      table { min-width: 0 !important; }
      thead { display: none; }
      tbody, tr, td { display: block; }
      tbody tr { padding: 1rem; }
      tbody td { padding: .35rem 0; text-align: left; }
      tbody td:nth-child(2)::before { content: 'Site: '; }
      tbody td:nth-child(3)::before { content: 'Management: '; }
      tbody td:nth-child(4)::before { content: 'Health: '; }
      tbody td:nth-child(5)::before { content: 'Last checked: '; }
      tbody td:last-child { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; padding-top: .75rem; }
      tbody td:last-child button { min-height: 44px; margin-bottom: 0; }
      tbody td:last-child p { flex-basis: 100%; }
    }
  `],
  imports: [DatePipe, FormsModule, ErrorStateComponent, SkeletonComponent, RouterLink],
  template: `
    <section class="space-y-6">
      <a routerLink="/admin/nodes" class="text-sm font-semibold text-signal">← Back to Nodes</a>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-2xl font-bold text-ink">Router management</h1>
          <p class="mt-1 text-sm text-[var(--text-secondary)]">
            Monitor connectivity across your sites and securely access RouterOS.
          </p>
        </div>
        <button type="button" class="rounded-xl border border-border px-4 py-2 text-sm text-signal" [disabled]="loading()" (click)="reload()">Refresh status</button>
        <label class="block text-sm">
          <span class="text-[var(--text-secondary)]">Site</span>
          <select
            class="mt-1 block min-w-[12rem] rounded-xl border border-border bg-surface-0 px-3 py-2 text-ink"
            [ngModel]="siteFilter()"
            (ngModelChange)="siteFilter.set($event)"
          >
            <option value="">Zote</option>
            @for (s of siteOptions(); track s) {
              <option [value]="s">{{ s }}</option>
            }
          </select>
        </label>
      </div>
      @if (statusFilter()) {<div class="flex items-center gap-3 rounded-xl border border-signal/30 bg-signal-muted px-4 py-2 text-sm">Health: <strong>{{ statusFilter() }}</strong><a routerLink="/admin/nodes/health" class="text-signal underline">Clear filter</a></div>}

      <div class="rounded-2xl border border-border bg-surface-1 p-5">
        <p class="font-semibold text-ink">Private router access</p>
        <p class="mt-2 text-sm text-[var(--text-secondary)]">Online reflects the last RouterOS API check. WebFig availability is verified when you connect.</p>
        <p class="mt-2 text-xs text-[var(--text-secondary)]">Access is limited to authorized routers. Sign in separately to RouterOS after opening your secure session.</p>
      </div>
      <label class="block text-sm">Search this page
        <input class="mt-2 block w-full rounded-xl border border-border bg-surface-0 px-4 py-3 text-ink" placeholder="Router name, identifier or site" [ngModel]="search()" (ngModelChange)="search.set($event)" />
      </label>
      <div class="flex items-center gap-3 text-sm">
        <button class="rounded-xl border border-border px-3 py-2" [disabled]="page() === 1 || loading()" (click)="changePage(-1)">Previous</button>
        <span>Page {{ page() }} · {{ filteredNodes().length }} shown</span>
        <button class="rounded-xl border border-border px-3 py-2" [disabled]="!hasNext() || loading()" (click)="changePage(1)">Next</button>
      </div>
      @if (loading()) {
        <app-skeleton height="8rem" />
      } @else if (error()) {
        <app-error-state title="Hitilafu" [message]="error()!" />
      } @else {
        <div class="overflow-x-auto rounded-2xl border border-border bg-surface-1 shadow-soft">
          <table class="w-full min-w-[40rem] text-left text-sm">
            <thead class="border-b border-border text-[var(--text-secondary)]">
              <tr>
                <th class="px-4 py-3 font-semibold">Node</th>
                <th class="px-4 py-3 font-semibold">Site</th>
                <th class="px-4 py-3 font-semibold">Management</th>
                <th class="px-4 py-3 font-semibold">Health</th>
                <th class="px-4 py-3 font-semibold">Check</th>
                <th class="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              @for (n of filteredNodes(); track n.id) {
                <tr class="border-b border-border/70">
                  <td class="px-4 py-3">
                    <p class="font-semibold text-ink">{{ n.display_name || n.node_identifier }}</p>
                    @if (n.display_name) {
                      <p class="text-xs text-[var(--text-secondary)]">{{ n.node_identifier }}</p>
                    }
                  </td>
                  <td class="px-4 py-3 text-[var(--text-secondary)]">{{ n.site_name }}</td>
                  <td class="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                    {{ n.remote_management?.available ? 'Available' : 'Unavailable' }}
                  </td>
                  <td class="px-4 py-3">
                    <span
                      [class]="
                        n.health_status === 'online'
                          ? 'text-success'
                          : n.health_status === 'offline'
                            ? 'text-danger'
                            : 'text-[var(--text-secondary)]'
                      "
                    >
                      {{ n.health_status }}
                    </span>
                    @if (!n.is_active) {
                      <p class="text-xs text-danger">inactive</p>
                    }
                  </td>
                  <td class="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    {{
                      n.last_health_check_at
                        ? (n.last_health_check_at | date: 'short')
                        : '—'
                    }}
                    @if (testMsg()[n.id]; as msg) {
                      <p class="mt-1" [class]="msg.ok ? 'text-success' : 'text-danger'">
                        {{ msg.detail }}
                      </p>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    @if (n.remote_management?.permitted) {
                      <button type="button" class="mb-2 rounded-xl bg-signal px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" [disabled]="!n.is_active || !n.remote_management?.available || openingId() !== null" (click)="openManagement(n)">{{ openingId() === n.id ? 'Creating session…' : 'Remote Management' }}</button>
                    }
                    @if (managementMsg()[n.id]; as message) {<p role="status" class="mb-2 max-w-xs text-xs text-danger">{{ message }}</p>}
                    <button
                      type="button"
                      class="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-signal hover:bg-signal-muted disabled:opacity-50"
                      [disabled]="testingId() !== null || !n.is_active"
                      (click)="test(n)"
                    >
                      {{ testingId() === n.id ? 'Checking…' : 'Test connection' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="px-4 py-8 text-[var(--text-secondary)]">
                    {{ statusFilter() ? 'No ' + statusFilter() + ' nodes found.' : 'Hakuna nodes.' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class AdminNodesComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly search = signal('');
  readonly requestedNode = signal('');
  readonly page = signal(1);
  readonly hasNext = signal(false);
  readonly openingId = signal<string | null>(null);
  readonly managementMsg = signal<Record<string, string>>({});
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly nodes = signal<NodeRow[]>([]);
  readonly siteFilter = signal('');
  readonly statusFilter = signal('');
  readonly testingId = signal<string | null>(null);
  readonly testMsg = signal<Record<string, { ok: boolean; detail: string }>>({});

  readonly siteOptions = computed(() => {
    const names = new Set(this.nodes().map((n) => n.site_name).filter(Boolean));
    return [...names].sort();
  });

  readonly filteredNodes = computed(() => {
    const rank = { offline: 0, unknown: 1, online: 2 } as const;
    const site = this.siteFilter();
    return this.nodes()
      .filter(n => [n.display_name, n.node_identifier, n.site_name].join(' ').toLowerCase().includes(this.search().toLowerCase()))
      .filter((n) => (!site || n.site_name === site) && (!this.statusFilter() || n.health_status === this.statusFilter()))
      .slice()
      .sort(
        (a, b) =>
          (rank[a.health_status] ?? 9) - (rank[b.health_status] ?? 9) ||
          a.site_name.localeCompare(b.site_name) ||
          a.node_identifier.localeCompare(b.node_identifier),
      );
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => { this.statusFilter.set(params.get('status') || ''); this.requestedNode.set(params.get('node') || ''); this.page.set(1); this.reload(); });
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getPage<NodeRow>('/admin/nodes/', { search: this.requestedNode(), page: this.page(), page_size: 100, health_status: this.statusFilter(), is_active: this.statusFilter() ? 'true' : '' }).subscribe({
      next: (data) => {
        this.nodes.set(data.rows);
        this.hasNext.set(data.next);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.loading.set(false);
      },
    });
  }

  changePage(delta: number): void { this.page.update(p => p + delta); this.reload(); }

  openManagement(node: NodeRow): void {
    if (!node.is_active || !node.remote_management?.available || !node.remote_management?.permitted || this.openingId()) return;
    const tab = window.open('about:blank', '_blank');
    if (!tab) {
      this.managementMsg.update(m => ({ ...m, [node.id]: 'Allow pop-ups for Bitech, then try again.' }));
      return;
    }
    tab.opener = null;
    this.openingId.set(node.id);
    this.managementMsg.update(m => ({ ...m, [node.id]: '' }));
    this.api.post<{ session_id: string; management_url: string }>(`/router-management/nodes/${node.id}/sessions/`, {}).subscribe({
      next: result => {
        this.openingId.set(null);
        try {
          const url = new URL(result.management_url);
          if (url.protocol !== 'https:' || !result.session_id || !url.hostname.startsWith(result.session_id + '.') || url.username || url.password || url.pathname !== '/_bitech/start' || url.search || !url.hash) throw new Error();
          tab.location.replace(url.href);
        } catch {
          tab.close();
          this.managementMsg.update(m => ({ ...m, [node.id]: 'Invalid secure gateway URL.' }));
        }
      },
      error: (err: unknown) => {
        tab.close();
        this.openingId.set(null);
        this.managementMsg.update(m => ({ ...m, [node.id]: err instanceof AppError && err.status === 403 ? 'You do not have permission to manage this router, or remote management is unavailable.' : 'Unable to create a management session.' }));
      },
    });
  }

  test(node: NodeRow): void {
    this.testingId.set(node.id);
    this.api.post<TestResult>(`/admin/nodes/${node.id}/test-connection/`, {}).subscribe({
      next: (res) => {
        this.testMsg.update((m) => ({
          ...m,
          [node.id]: { ok: res.ok, detail: res.detail },
        }));
        this.nodes.update((list) =>
          list.map((n) =>
            n.id === node.id
              ? {
                  ...n,
                  health_status: res.health_status,
                  last_health_check_at: res.last_health_check_at,
                }
              : n,
          ),
        );
        this.testingId.set(null);
      },
      error: (err: unknown) => {
        this.testMsg.update((m) => ({
          ...m,
          [node.id]: {
            ok: false,
            detail: err instanceof AppError ? err.message : 'Test failed',
          },
        }));
        this.testingId.set(null);
      },
    });
  }
}
