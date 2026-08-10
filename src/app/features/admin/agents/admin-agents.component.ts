import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiClient } from '../../../core/api/api-client';
import { AppError } from '../../../core/models/app-error';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';

interface SiteOpt {
  id: string;
  name: string;
}

interface NodeOpt {
  id: string;
  site: string;
  site_name: string;
  node_identifier: string;
  health_status: string;
  is_active: boolean;
}

interface PackageOpt {
  id: string;
  site: string;
  name: string;
  price_tzs: string;
  is_active: boolean;
  node: string | null;
}

interface DebtInfo {
  unpaid_total: string;
  unpaid_batches: number;
  unpaid_vouchers: number;
  has_debt: boolean;
}

interface AgentRow {
  id: string;
  username: string;
  display_name: string;
  phone_number: string;
  agent_code: string;
  site_ids: string[];
  site_names: string[];
  is_active: boolean;
  notes: string;
  debt?: DebtInfo;
  created_at: string;
}

interface BatchItem {
  line_no: number;
  voucher_code: string | null;
  provisioning_status: string;
}

interface BatchRow {
  id: string;
  agent_code: string;
  agent_name: string;
  site_name: string;
  node_identifier: string;
  package_name_snapshot: string;
  quantity: number;
  settlement_mode: string;
  settlement_status: string;
  total_amount: string;
  created_at: string;
  items?: BatchItem[];
}

interface DebtLedger {
  grand_unpaid_total: string;
  agents_with_debt: number;
  unpaid_batches: number;
  unpaid_vouchers: number;
  agents: {
    agent_id: string;
    agent_code: string;
    agent_name: string;
    site_names: string[];
    unpaid_total: string;
    unpaid_batches: number;
    unpaid_vouchers: number;
  }[];
  batches: {
    id: string;
    agent_code: string;
    agent_name: string;
    site_name: string;
    package_name: string;
    quantity: number;
    total_amount: string;
    created_at: string;
  }[];
}

interface VoucherRow {
  id: string;
  batch_id: string;
  agent_code: string;
  agent_name: string;
  site_name: string;
  package_name: string;
  amount: string;
  voucher_code: string | null;
  provisioning_status: string;
  settlement_status: string;
  is_unpaid: boolean;
  is_used: boolean;
  mac_address: string;
  device_name: string;
  issued_at: string;
}

@Component({
  selector: 'app-admin-agents',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    ErrorStateComponent,
    SkeletonComponent,
    DatePipe,
    DecimalPipe,
  ],
  template: `
    <section class="space-y-8">
      <div>
        <h1 class="font-display text-2xl font-bold text-ink">Agents</h1>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">
          Sajili agents, tengeneza vouchers, fuatilia deni zote na kila voucher + package.
        </p>
      </div>

      @if (debts(); as d) {
        <div class="rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="font-display text-lg font-semibold text-ink">Deni zote (madini)</h2>
              <p class="mt-1 text-sm text-[var(--text-secondary)]">
                Jumla ya deni za agents kwenye sites zako
              </p>
            </div>
            <p class="font-display text-3xl font-bold text-warning">
              TZS {{ d.grand_unpaid_total | number: '1.0-0' }}
            </p>
          </div>
          <div class="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
            <span>{{ d.agents_with_debt }} agents wenye deni</span>
            <span>{{ d.unpaid_batches }} batches</span>
            <span>{{ d.unpaid_vouchers }} vouchers</span>
          </div>
          @if (d.agents.length) {
            <ul class="mt-4 divide-y divide-border border-t border-border">
              @for (a of d.agents; track a.agent_id) {
                <li class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p class="font-semibold text-ink">
                      {{ a.agent_name }}
                      <span class="font-mono text-xs text-[var(--text-secondary)]"
                        >({{ a.agent_code }})</span
                      >
                    </p>
                    <p class="text-xs text-[var(--text-secondary)]">
                      {{ a.site_names.join(', ') }} · {{ a.unpaid_vouchers }} vouchers
                    </p>
                  </div>
                  <p class="font-semibold text-warning">
                    TZS {{ a.unpaid_total | number: '1.0-0' }}
                  </p>
                </li>
              }
            </ul>
          } @else {
            <p class="mt-4 text-sm text-success">Hakuna deni kwa sasa.</p>
          }
        </div>
      }

      <!-- Register -->
      <form
        class="space-y-4 rounded-2xl border border-border bg-surface-1 p-5 shadow-soft"
        [formGroup]="form"
        (ngSubmit)="create()"
      >
        <p class="font-display text-lg font-semibold text-ink">Sajili agent mpya</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="text-[var(--text-secondary)]">Display name</span>
            <input
              formControlName="display_name"
              class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-ink"
            />
          </label>
          <label class="block text-sm">
            <span class="text-[var(--text-secondary)]">Username (login)</span>
            <input
              formControlName="username"
              class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-ink"
              autocomplete="off"
            />
          </label>
          <label class="block text-sm">
            <span class="text-[var(--text-secondary)]">Nenosiri</span>
            <input
              type="password"
              formControlName="password"
              class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-ink"
              autocomplete="new-password"
            />
          </label>
          <label class="block text-sm">
            <span class="text-[var(--text-secondary)]">Simu</span>
            <input
              formControlName="phone_number"
              class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-ink"
            />
          </label>
          <label class="block text-sm">
            <span class="text-[var(--text-secondary)]">Agent code (hiari)</span>
            <input
              formControlName="agent_code"
              class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-ink"
            />
          </label>
        </div>
        <div>
          <p class="mb-2 text-sm font-semibold text-ink">Sites</p>
          <div class="grid gap-2 sm:grid-cols-2">
            @for (s of sites(); track s.id) {
              <label
                class="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm"
                [class.border-signal]="isSiteSelected(s.id)"
              >
                <input
                  type="checkbox"
                  [checked]="isSiteSelected(s.id)"
                  (change)="toggleSite(s.id, $event)"
                />
                <span class="text-ink">{{ s.name }}</span>
              </label>
            }
          </div>
        </div>
        @if (formError()) {
          <app-error-state title="Hitilafu" [message]="formError()!" />
        }
        @if (formOk()) {
          <p class="text-sm font-semibold text-success">{{ formOk() }}</p>
        }
        <app-button type="submit" [loading]="creating()" [disabled]="form.invalid">
          Sajili agent
        </app-button>
      </form>

      <!-- Issue vouchers -->
      <form
        class="space-y-4 rounded-2xl border border-border bg-surface-1 p-5 shadow-soft"
        [formGroup]="issueForm"
        (ngSubmit)="issue()"
      >
        <div>
          <p class="font-display text-lg font-semibold text-ink">Tengeneza vouchers kwa agent</p>
          <p class="mt-1 text-sm text-[var(--text-secondary)]">
            Kila package ina idadi yake — unaweza kutoa packages tofauti kwa agent mmoja
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-sm sm:col-span-2">
            <span class="text-[var(--text-secondary)]">Agent</span>
            <select
              formControlName="agent_id"
              class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-ink"
            >
              <option value="" disabled>Chagua agent</option>
              @for (a of activeAgents(); track a.id) {
                <option [value]="a.id">{{ a.display_name }} ({{ a.agent_code }})</option>
              }
            </select>
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="text-[var(--text-secondary)]">Node</span>
            <select
              formControlName="node_id"
              class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-ink"
            >
              <option value="" disabled>Chagua node</option>
              @for (n of filteredNodes(); track n.id) {
                <option [value]="n.id">
                  {{ n.node_identifier }} — {{ n.site_name }} ({{ n.health_status }})
                </option>
              }
            </select>
          </label>
        </div>

        <div class="space-y-3" formArrayName="lines">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-ink">Packages + idadi</p>
            <button
              type="button"
              class="text-sm font-semibold text-signal hover:text-signal-hover"
              (click)="addIssueLine()"
              [disabled]="!issueForm.controls.node_id.value"
            >
              + Ongeza package
            </button>
          </div>
          @for (line of issueLines.controls; track line; let i = $index) {
            <div
              class="grid gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[1fr_7rem_auto]"
              [formGroupName]="i"
            >
              <label class="block text-sm">
                <span class="text-[var(--text-secondary)]">Package</span>
                <select
                  formControlName="package_id"
                  class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-ink"
                >
                  <option value="" disabled>Chagua package</option>
                  @for (p of availablePackagesForLine(i); track p.id) {
                    <option [value]="p.id">
                      {{ p.name }} — TZS {{ p.price_tzs | number: '1.0-0' }}
                    </option>
                  }
                </select>
              </label>
              <label class="block text-sm">
                <span class="text-[var(--text-secondary)]">Idadi</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  formControlName="quantity"
                  class="mt-1 w-full rounded-xl border border-border bg-surface-0 px-3 py-2.5 text-ink"
                />
              </label>
              <div class="flex items-end pb-1">
                <button
                  type="button"
                  class="text-sm font-semibold text-danger disabled:opacity-40"
                  (click)="removeIssueLine(i)"
                  [disabled]="issueLines.length <= 1"
                >
                  Ondoa
                </button>
              </div>
            </div>
          }
        </div>

        <fieldset class="space-y-2">
          <legend class="text-sm font-semibold text-ink">Malipo</legend>
          <label
            class="flex cursor-pointer gap-3 rounded-2xl border border-border p-4"
            [class.border-signal]="issueForm.controls.settlement_mode.value === 'pay_all'"
          >
            <input type="radio" formControlName="settlement_mode" value="pay_all" class="mt-1" />
            <span>
              <span class="block font-semibold text-ink">Lipa vouchers zote sasa</span>
              <span class="mt-1 block text-sm text-[var(--text-secondary)]">
                Batches zote zinahesabiwa kama zimelipwa.
              </span>
            </span>
          </label>
          <label
            class="flex cursor-pointer gap-3 rounded-2xl border border-border p-4"
            [class.border-signal]="issueForm.controls.settlement_mode.value === 'unpaid_recorded'"
          >
            <input
              type="radio"
              formControlName="settlement_mode"
              value="unpaid_recorded"
              class="mt-1"
            />
            <span>
              <span class="block font-semibold text-ink">Toa bila kulipa sasa (rekodi deni)</span>
              <span class="mt-1 block text-sm text-[var(--text-secondary)]">
                Codes zinatengenezwa; settle baadaye kutoka hapa.
              </span>
            </span>
          </label>
        </fieldset>

        @if (issueTotal(); as total) {
          <p class="text-sm text-[var(--text-secondary)]">
            Jumla:
            <span class="font-display text-lg font-bold text-signal">
              TZS {{ total | number: '1.0-0' }}
            </span>
            <span class="ml-2 text-xs">({{ issueLines.length }} package{{ issueLines.length > 1 ? 's' : '' }})</span>
          </p>
        }
        @if (issueError()) {
          <app-error-state title="Hitilafu" [message]="issueError()!" />
        }
        <app-button type="submit" [loading]="issuing()" [disabled]="!canIssue()">
          Tengeneza vouchers
        </app-button>
      </form>

      @if (issueResults(); as batches) {
        <div class="space-y-3 rounded-2xl border border-success/30 bg-surface-1 p-5 shadow-soft">
          <p class="font-display text-lg font-semibold text-success">
            {{ batches.length }} batch{{ batches.length > 1 ? 'es' : '' }} zimeundwa
          </p>
          @for (batch of batches; track batch.id) {
            <div class="border-t border-border pt-3 first:border-t-0 first:pt-0">
              <p class="text-sm text-[var(--text-secondary)]">
                {{ batch.quantity }}× {{ batch.package_name_snapshot }} · TZS
                {{ batch.total_amount | number: '1.0-0' }}
              </p>
              <ul class="mt-2 divide-y divide-border font-mono text-sm">
                @for (item of batch.items || []; track item.line_no) {
                  <li class="flex justify-between py-1.5">
                    <span class="text-signal">{{ item.voucher_code || '…' }}</span>
                    <span class="text-[var(--text-secondary)]">{{ item.provisioning_status }}</span>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      }

      <!-- Agent list -->
      @if (loading()) {
        <app-skeleton height="10rem" />
      } @else if (listError()) {
        <app-error-state title="Hitilafu" [message]="listError()!" />
      } @else {
        <div class="overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-soft">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-border text-[var(--text-secondary)]">
              <tr>
                <th class="px-4 py-3 font-semibold">Agent</th>
                <th class="px-4 py-3 font-semibold">Sites</th>
                <th class="px-4 py-3 font-semibold">Deni</th>
                <th class="px-4 py-3 font-semibold">Hali</th>
                <th class="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              @for (a of agents(); track a.id) {
                <tr class="border-b border-border/70">
                  <td class="px-4 py-3">
                    <p class="font-semibold text-ink">{{ a.display_name }}</p>
                    <p class="mt-0.5 font-mono text-xs text-[var(--text-secondary)]">
                      {{ a.agent_code }} · {{ a.username }}
                    </p>
                  </td>
                  <td class="px-4 py-3 text-[var(--text-secondary)]">
                    {{ a.site_names.join(', ') || '—' }}
                  </td>
                  <td class="px-4 py-3">
                    @if (a.debt?.has_debt) {
                      <span class="font-semibold text-warning">
                        TZS {{ a.debt!.unpaid_total | number: '1.0-0' }}
                      </span>
                      <p class="text-xs text-[var(--text-secondary)]">
                        {{ a.debt!.unpaid_vouchers }} vouchers
                      </p>
                    } @else {
                      <span class="text-success">Hakuna</span>
                    }
                  </td>
                  <td class="px-4 py-3">
                    <span [class]="a.is_active ? 'text-success' : 'text-danger'">
                      {{ a.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      type="button"
                      class="text-sm font-semibold text-signal hover:text-signal-hover"
                      (click)="toggleActive(a)"
                      [disabled]="togglingId() === a.id"
                    >
                      {{ a.is_active ? 'Zima' : 'Washa' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="px-4 py-8 text-center text-[var(--text-secondary)]">
                    Hakuna agents bado.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Batches -->
      <div>
        <h2 class="font-display text-lg font-semibold text-ink">Batches za agents</h2>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">
          Settle deni kwa batch — au angalia vouchers moja moja chini
        </p>
        @if (batchesLoading()) {
          <app-skeleton height="6rem" class="mt-3" />
        } @else if (!batches().length) {
          <p class="mt-3 text-sm text-[var(--text-secondary)]">Hakuna batches.</p>
        } @else {
          <ul class="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface-1">
            @for (b of batches(); track b.id) {
              <li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p class="font-semibold text-ink">
                    {{ b.agent_name }}
                    <span class="font-mono text-xs text-[var(--text-secondary)]"
                      >({{ b.agent_code }})</span
                    >
                  </p>
                  <p class="text-xs text-[var(--text-secondary)]">
                    {{ b.site_name }} · {{ b.quantity }}× {{ b.package_name_snapshot }} ·
                    {{ b.created_at | date: 'short' }}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-right">
                    <p class="font-semibold text-signal">
                      TZS {{ b.total_amount | number: '1.0-0' }}
                    </p>
                    <p class="text-xs text-[var(--text-secondary)]">
                      {{
                        b.settlement_status === 'unpaid'
                          ? 'Haijalipwa'
                          : b.settlement_mode === 'pay_all'
                            ? 'Lipa zote'
                            : 'Imelipwa'
                      }}
                    </p>
                  </div>
                  @if (b.settlement_status === 'unpaid') {
                    <button
                      type="button"
                      class="rounded-xl bg-signal px-3 py-2 text-xs font-semibold text-[var(--text-inverse)] disabled:opacity-60"
                      [disabled]="settlingId() === b.id"
                      (click)="settle(b.id)"
                    >
                      Settle
                    </button>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </div>

      <!-- All vouchers -->
      <div>
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="font-display text-lg font-semibold text-ink">Vouchers zote</h2>
            <p class="mt-1 text-sm text-[var(--text-secondary)]">
              Kila voucher na package yake — filter deni
            </p>
          </div>
          <div class="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              class="rounded-xl px-3 py-1.5 font-semibold"
              [class]="
                voucherFilter() === 'all'
                  ? 'bg-signal text-[var(--text-inverse)]'
                  : 'bg-surface-2 text-[var(--text-secondary)]'
              "
              (click)="setVoucherFilter('all')"
            >
              Zote
            </button>
            <button
              type="button"
              class="rounded-xl px-3 py-1.5 font-semibold"
              [class]="
                voucherFilter() === 'unpaid'
                  ? 'bg-signal text-[var(--text-inverse)]'
                  : 'bg-surface-2 text-[var(--text-secondary)]'
              "
              (click)="setVoucherFilter('unpaid')"
            >
              Zenye deni
            </button>
          </div>
        </div>
        @if (vouchersLoading()) {
          <app-skeleton height="8rem" class="mt-3" />
        } @else if (!vouchers().length) {
          <p class="mt-3 text-sm text-[var(--text-secondary)]">Hakuna vouchers bado.</p>
        } @else {
          <div
            class="mt-3 overflow-x-auto rounded-2xl border border-border bg-surface-1 shadow-soft"
          >
            <table class="w-full min-w-[52rem] text-left text-sm">
              <thead class="border-b border-border text-[var(--text-secondary)]">
                <tr>
                  <th class="px-4 py-3 font-semibold">Voucher</th>
                  <th class="px-4 py-3 font-semibold">Agent</th>
                  <th class="px-4 py-3 font-semibold">Package</th>
                  <th class="px-4 py-3 font-semibold">Bei</th>
                  <th class="px-4 py-3 font-semibold">Matumizi</th>
                  <th class="px-4 py-3 font-semibold">Hali</th>
                  <th class="px-4 py-3 font-semibold">Tarehe</th>
                </tr>
              </thead>
              <tbody>
                @for (v of vouchers(); track v.id) {
                  <tr class="border-b border-border/70">
                    <td class="px-4 py-3 font-mono font-semibold text-signal">
                      {{ v.voucher_code || 'pending…' }}
                      <p class="font-sans text-xs font-normal text-[var(--text-secondary)]">
                        {{ v.site_name }}
                      </p>
                    </td>
                    <td class="px-4 py-3">
                      <p class="text-ink">{{ v.agent_name }}</p>
                      <p class="font-mono text-xs text-[var(--text-secondary)]">
                        {{ v.agent_code }}
                      </p>
                    </td>
                    <td class="px-4 py-3 text-ink">{{ v.package_name }}</td>
                    <td class="px-4 py-3 text-[var(--text-secondary)]">
                      TZS {{ v.amount | number: '1.0-0' }}
                    </td>
                    <td class="px-4 py-3">
                      @if (v.is_used) {
                        <span class="font-semibold text-signal">Imetumika</span>
                        <p class="mt-0.5 font-mono text-xs text-[var(--text-secondary)]">
                          MAC: {{ v.mac_address || '—' }}
                        </p>
                        <p class="text-xs text-ink">
                          Kifaa: {{ v.device_name || 'Hakijulikani' }}
                        </p>
                      } @else {
                        <span class="text-[var(--text-secondary)]">Haijatumika</span>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <span [class]="v.is_unpaid ? 'text-warning' : 'text-success'">
                        {{ v.is_unpaid ? 'Deni' : 'Imelipwa' }}
                      </span>
                      <p class="text-xs text-[var(--text-secondary)]">
                        {{ v.provisioning_status }}
                      </p>
                    </td>
                    <td class="px-4 py-3 text-xs text-[var(--text-secondary)]">
                      {{ v.issued_at | date: 'short' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>
  `,
})
export class AdminAgentsComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly fb = inject(FormBuilder);

  readonly sites = signal<SiteOpt[]>([]);
  readonly nodes = signal<NodeOpt[]>([]);
  readonly packages = signal<PackageOpt[]>([]);
  readonly agents = signal<AgentRow[]>([]);
  readonly batches = signal<BatchRow[]>([]);
  readonly debts = signal<DebtLedger | null>(null);
  readonly vouchers = signal<VoucherRow[]>([]);
  readonly voucherFilter = signal<'all' | 'unpaid'>('all');
  readonly loading = signal(true);
  readonly batchesLoading = signal(true);
  readonly vouchersLoading = signal(true);
  readonly creating = signal(false);
  readonly issuing = signal(false);
  readonly settlingId = signal<string | null>(null);
  readonly togglingId = signal<string | null>(null);
  readonly listError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly formOk = signal<string | null>(null);
  readonly issueError = signal<string | null>(null);
  readonly issueResults = signal<BatchRow[] | null>(null);

  readonly form = this.fb.nonNullable.group({
    display_name: ['', Validators.required],
    username: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone_number: [''],
    agent_code: [''],
    site_ids: this.fb.nonNullable.control<string[]>([], (ctrl) =>
      ctrl.value?.length ? null : { required: true },
    ),
  });

  readonly issueForm = this.fb.nonNullable.group({
    agent_id: ['', Validators.required],
    node_id: ['', Validators.required],
    lines: this.fb.array([this.newIssueLine()]),
    settlement_mode: this.fb.nonNullable.control<'pay_all' | 'unpaid_recorded'>(
      'pay_all',
      Validators.required,
    ),
  });

  get issueLines(): FormArray {
    return this.issueForm.get('lines') as FormArray;
  }

  ngOnInit(): void {
    this.api.get<SiteOpt[]>('/admin/sites/').subscribe({
      next: (data) => this.sites.set(Array.isArray(data) ? data : []),
    });
    this.api.get<NodeOpt[]>('/admin/nodes/', { page_size: 200 }).subscribe({
      next: (data) =>
        this.nodes.set(
          (Array.isArray(data) ? data : []).map((n) => ({
            ...n,
            id: String(n.id),
            site: String(n.site),
          })),
        ),
    });
    this.api.get<PackageOpt[]>('/admin/packages/', { page_size: 200 }).subscribe({
      next: (data) =>
        this.packages.set(
          (Array.isArray(data) ? data : []).map((p) => ({
            ...p,
            id: String(p.id),
            site: String(p.site),
            node: p.node == null || p.node === '' ? null : String(p.node),
          })),
        ),
    });
    this.reloadAgents();
    this.reloadBatches();
    this.reloadDebts();
    this.reloadVouchers();

    // Reset package lines only when agent/node actually changes (not on every select event).
    let prevAgent = this.issueForm.controls.agent_id.value;
    let prevNode = this.issueForm.controls.node_id.value;
    this.issueForm.controls.agent_id.valueChanges.subscribe((agentId) => {
      if (agentId === prevAgent) return;
      prevAgent = agentId;
      this.issueForm.controls.node_id.setValue('', { emitEvent: true });
      this.resetIssueLines();
    });
    this.issueForm.controls.node_id.valueChanges.subscribe((nodeId) => {
      if (nodeId === prevNode) return;
      prevNode = nodeId;
      this.resetIssueLines();
    });
  }

  setVoucherFilter(f: 'all' | 'unpaid'): void {
    this.voucherFilter.set(f);
    this.reloadVouchers();
  }

  activeAgents(): AgentRow[] {
    return this.agents().filter((a) => a.is_active);
  }

  filteredNodes(): NodeOpt[] {
    const agentId = String(this.issueForm.controls.agent_id.value || '');
    const agent = this.agents().find((a) => a.id === agentId);
    if (!agent) return [];
    const siteIds = new Set(agent.site_ids.map(String));
    return this.nodes().filter((n) => n.is_active && siteIds.has(String(n.site)));
  }

  filteredPackages(): PackageOpt[] {
    const nodeId = String(this.issueForm.controls.node_id.value || '');
    const node = this.nodes().find((n) => String(n.id) === nodeId);
    if (!node) return [];
    const siteId = String(node.site);
    return this.packages().filter((p) => {
      if (!p.is_active || String(p.site) !== siteId) return false;
      if (p.node == null || p.node === '') return true;
      return String(p.node) === nodeId;
    });
  }

  /** Packages still available for a line (exclude ones already picked on other lines). */
  availablePackagesForLine(lineIndex: number): PackageOpt[] {
    const currentId = String(this.issueLines.at(lineIndex)?.get('package_id')?.value || '');
    const selected = new Set(
      this.issueLines.controls
        .map((c, i) => (i === lineIndex ? '' : String(c.get('package_id')?.value || '')))
        .filter(Boolean),
    );
    return this.filteredPackages().filter((p) => !selected.has(p.id) || p.id === currentId);
  }

  newIssueLine() {
    return this.fb.group({
      package_id: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
    });
  }

  addIssueLine(): void {
    if (this.issueLines.length >= this.filteredPackages().length) return;
    this.issueLines.push(this.newIssueLine());
  }

  removeIssueLine(index: number): void {
    if (this.issueLines.length <= 1) return;
    this.issueLines.removeAt(index);
  }

  canIssue(): boolean {
    if (this.issuing()) return false;
    const agentId = String(this.issueForm.controls.agent_id.value || '');
    const nodeId = String(this.issueForm.controls.node_id.value || '');
    if (!agentId || !nodeId) return false;
    if (!this.issueLines.length) return false;
    const seen = new Set<string>();
    for (const ctrl of this.issueLines.controls) {
      const pkgId = String(ctrl.get('package_id')?.value || '');
      const qty = Number(ctrl.get('quantity')?.value);
      if (!pkgId || !Number.isFinite(qty) || qty < 1 || qty > 100) return false;
      if (seen.has(pkgId)) return false;
      seen.add(pkgId);
    }
    return true;
  }

  issueTotal(): number | null {
    let total = 0;
    let any = false;
    for (const ctrl of this.issueLines.controls) {
      const pkgId = String(ctrl.get('package_id')?.value || '');
      const qty = Number(ctrl.get('quantity')?.value || 0);
      const pkg = this.packages().find((p) => p.id === pkgId);
      if (!pkg || !qty) continue;
      any = true;
      total += Number(pkg.price_tzs) * qty;
    }
    return any ? total : null;
  }

  private resetIssueLines(): void {
    this.issueLines.clear();
    this.issueLines.push(this.newIssueLine());
  }

  isSiteSelected(id: string): boolean {
    return this.form.controls.site_ids.value.includes(id);
  }

  toggleSite(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = [...this.form.controls.site_ids.value];
    if (checked && !current.includes(id)) {
      current.push(id);
    } else if (!checked) {
      const i = current.indexOf(id);
      if (i >= 0) current.splice(i, 1);
    }
    this.form.controls.site_ids.setValue(current);
    this.form.controls.site_ids.markAsTouched();
  }

  create(): void {
    if (this.form.invalid || !this.form.controls.site_ids.value.length) {
      this.formError.set('Jaza taarifa zote na chagua angalau site moja.');
      return;
    }
    this.creating.set(true);
    this.formError.set(null);
    this.formOk.set(null);
    const v = this.form.getRawValue();
    this.api
      .post<AgentRow>('/admin/agents/', {
        username: v.username,
        password: v.password,
        display_name: v.display_name,
        phone_number: v.phone_number,
        agent_code: v.agent_code || undefined,
        site_ids: v.site_ids,
      })
      .subscribe({
        next: (agent) => {
          this.formOk.set(`Agent ${agent.display_name} (${agent.agent_code}) amesajiliwa.`);
          this.form.reset({
            display_name: '',
            username: '',
            password: '',
            phone_number: '',
            agent_code: '',
            site_ids: [],
          });
          this.creating.set(false);
          this.reloadAgents();
        },
        error: (err: unknown) => {
          this.formError.set(err instanceof AppError ? err.message : this.errMsg(err));
          this.creating.set(false);
        },
      });
  }

  issue(): void {
    if (!this.canIssue()) {
      this.issueError.set('Chagua agent, node, na kila package na idadi yake (1–100).');
      return;
    }
    this.issuing.set(true);
    this.issueError.set(null);
    this.issueResults.set(null);
    const v = this.issueForm.getRawValue();
    const lines = (v.lines as { package_id: string; quantity: number }[]).map((l) => ({
      package_id: String(l.package_id),
      quantity: Number(l.quantity),
    }));
    this.api
      .post<{ count: number; batches: BatchRow[] }>('/admin/agent-batches/', {
        agent_id: v.agent_id,
        node_id: v.node_id,
        settlement_mode: v.settlement_mode,
        lines,
      })
      .subscribe({
        next: (res) => {
          const batches = res.batches ?? [];
          this.issueResults.set(batches);
          this.issuing.set(false);
          this.reloadBatches();
          this.reloadDebts();
          this.reloadVouchers();
          this.reloadAgents();
          for (const batch of batches) {
            setTimeout(() => this.refreshIssued(batch.id), 1500);
          }
        },
        error: (err: unknown) => {
          this.issueError.set(err instanceof AppError ? err.message : this.errMsg(err));
          this.issuing.set(false);
        },
      });
  }

  settle(id: string): void {
    this.settlingId.set(id);
    this.api.post<BatchRow>(`/admin/agent-batches/${id}/settle/`, {}).subscribe({
      next: () => {
        this.settlingId.set(null);
        this.reloadBatches();
        this.reloadDebts();
        this.reloadVouchers();
        this.reloadAgents();
      },
      error: () => this.settlingId.set(null),
    });
  }

  toggleActive(agent: AgentRow): void {
    this.togglingId.set(agent.id);
    this.api
      .patch<AgentRow>(`/admin/agents/${agent.id}/`, { is_active: !agent.is_active })
      .subscribe({
        next: () => {
          this.togglingId.set(null);
          this.reloadAgents();
        },
        error: () => this.togglingId.set(null),
      });
  }

  private refreshIssued(id: string): void {
    this.api.get<BatchRow>(`/admin/agent-batches/${id}/`).subscribe({
      next: (b) => {
        const current = this.issueResults() ?? [];
        this.issueResults.set(current.map((x) => (x.id === id ? b : x)));
      },
    });
  }

  private reloadAgents(): void {
    this.loading.set(true);
    this.api.get<AgentRow[]>('/admin/agents/').subscribe({
      next: (data) => {
        this.agents.set(
          (Array.isArray(data) ? data : []).map((a) => ({
            ...a,
            id: String(a.id),
            site_ids: (a.site_ids || []).map(String),
          })),
        );
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.listError.set(err instanceof AppError ? err.message : this.errMsg(err));
        this.loading.set(false);
      },
    });
  }

  private reloadBatches(): void {
    this.batchesLoading.set(true);
    this.api.get<BatchRow[]>('/admin/agent-batches/').subscribe({
      next: (data) => {
        this.batches.set(Array.isArray(data) ? data : []);
        this.batchesLoading.set(false);
      },
      error: () => this.batchesLoading.set(false),
    });
  }

  private reloadDebts(): void {
    this.api.get<DebtLedger>('/admin/agent-debts/').subscribe({
      next: (data) => this.debts.set(data),
    });
  }

  private reloadVouchers(): void {
    this.vouchersLoading.set(true);
    const params: Record<string, string> = { limit: '300' };
    if (this.voucherFilter() === 'unpaid') params['unpaid'] = 'true';
    this.api.get<VoucherRow[]>('/admin/agent-vouchers/', params).subscribe({
      next: (data) => {
        this.vouchers.set(Array.isArray(data) ? data : []);
        this.vouchersLoading.set(false);
      },
      error: () => this.vouchersLoading.set(false),
    });
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : 'Hitilafu.';
  }
}
