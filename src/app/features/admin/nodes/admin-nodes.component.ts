import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiClient } from '../../../core/api/api-client';
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
  imports: [DatePipe, FormsModule, ErrorStateComponent, SkeletonComponent],
  template: `
    <section class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-display text-2xl font-bold text-ink">Nodes / Health</h1>
          <p class="mt-1 text-sm text-[var(--text-secondary)]">
            Multi-site — offline juu; filter kwa site
          </p>
        </div>
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
                <th class="px-4 py-3 font-semibold">Host</th>
                <th class="px-4 py-3 font-semibold">Health</th>
                <th class="px-4 py-3 font-semibold">Check</th>
                <th class="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              @for (n of filteredNodes(); track n.id) {
                <tr class="border-b border-border/70">
                  <td class="px-4 py-3">
                    <p class="font-semibold text-ink">{{ n.node_identifier }}</p>
                    @if (n.display_name) {
                      <p class="text-xs text-[var(--text-secondary)]">{{ n.display_name }}</p>
                    }
                  </td>
                  <td class="px-4 py-3 text-[var(--text-secondary)]">{{ n.site_name }}</td>
                  <td class="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                    {{ n.mikrotik_host }}:{{ n.api_port }}
                    {{ n.use_ssl ? 'ssl' : 'plain' }}
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
                    <button
                      type="button"
                      class="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-signal hover:bg-signal-muted disabled:opacity-50"
                      [disabled]="testingId() === n.id"
                      (click)="test(n)"
                    >
                      {{ testingId() === n.id ? '…' : 'Test' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="px-4 py-8 text-[var(--text-secondary)]">
                    Hakuna nodes.
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
  private readonly api = inject(ApiClient);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly nodes = signal<NodeRow[]>([]);
  readonly siteFilter = signal('');
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
      .filter((n) => !site || n.site_name === site)
      .slice()
      .sort(
        (a, b) =>
          (rank[a.health_status] ?? 9) - (rank[b.health_status] ?? 9) ||
          a.site_name.localeCompare(b.site_name) ||
          a.node_identifier.localeCompare(b.node_identifier),
      );
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.get<NodeRow[]>('/admin/nodes/', { page_size: 100 }).subscribe({
      next: (data) => {
        this.nodes.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof AppError ? err.message : 'Hitilafu.');
        this.loading.set(false);
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
