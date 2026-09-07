import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { createIdempotencyKey } from '../../../core/api/idempotency-key';
import { AuthService } from '../../../core/auth/auth.service';
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
  issuance_request?: string | null;
  agent: string;
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

interface PrintJob {
  id: string;
  print_number: number;
  voucher_count: number;
}

interface PrintInfo {
  eligibility: { total: number; eligible: number; excluded: number };
  history: PrintJob[];
}

interface AssignmentRow {
  id: string;
  site: string;
  site_name: string;
  status: 'active' | 'suspended' | 'ended';
  suspension_reason: string;
  end_reason: string;
  print_permission: {
    enabled: boolean;
    granted_by: string;
    granted_at: string | null;
    revoked_by: string;
    revoked_at: string | null;
  };
}

interface ReasonDialog {
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  danger: boolean;
  submit: (reason: string) => void;
}

interface IssuanceResponse {
  id: string;
  status: string;
  summary: { requested: number; ready: number; pending: number; failed: number };
  batches: BatchRow[];
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
    RouterLink,
  ],
  template: `
    <section class="space-y-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div><h1 class="font-display text-2xl font-bold text-ink">Agents</h1>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">Chagua agent kuona batches zake, vouchers na kuchapisha PDF.</p></div>
        <a routerLink="/admin/agent-batches" class="rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-[var(--text-inverse)] no-underline">View Agent Batches & Print</a>
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
      @if (auth.isSuperAdmin()) {
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
      }

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
                Rekodi ushahidi wa fedha ulizopokea. Receipt itaunganishwa na charges za batch hii.
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
                Charge itarekodiwa. Malipo yatathibitishwa kwa receipt na kiasi kilicholipia batch.
              </span>
            </span>
          </label>
        </fieldset>

        @if (issueForm.controls.settlement_mode.value === 'pay_all') {
          <fieldset class="grid gap-4 rounded-2xl border border-border p-4 sm:grid-cols-2">
            <legend class="px-2 font-semibold">Ushahidi wa malipo yaliyopokelewa</legend>
            <label class="grid gap-2">Njia ya malipo
              <select formControlName="receipt_method" class="rounded-xl border border-border bg-surface-1 p-3">
                <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option>
                <option value="mobile_money">Mobile money</option><option value="other">Other</option>
              </select>
            </label>
            <label class="grid gap-2">Tarehe na saa ya kupokea
              <input type="datetime-local" formControlName="receipt_received_at" class="rounded-xl border border-border bg-surface-1 p-3" />
            </label>
            @if (issueForm.controls.receipt_method.value !== 'cash') {
              <label class="grid gap-2">Reference ya muamala
                <input formControlName="receipt_reference" maxlength="120" class="rounded-xl border border-border bg-surface-1 p-3" />
              </label>
              <label class="grid gap-2">Benki/provider na akaunti iliyopokea
                <input formControlName="receipt_scope" maxlength="80" class="rounded-xl border border-border bg-surface-1 p-3" />
              </label>
            }
            <label class="grid gap-2 sm:col-span-2">Maelezo ya uthibitisho wa fedha
              <textarea formControlName="receipt_notes" maxlength="500" rows="2" class="rounded-xl border border-border bg-surface-1 p-3"></textarea>
            </label>
          </fieldset>
        }

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
          {{ issuing() ? 'Inatengeneza batch, tafadhali subiri…' : 'Tengeneza vouchers' }}
        </app-button>
        @if (issuing()) {<p class="text-xs text-[var(--text-secondary)]">Ombi limetumwa salama. Usibonyeze tena au kuondoka kwenye ukurasa.</p>}
      </form>

      @if (issueResults(); as batches) {
        <div class="space-y-3 rounded-2xl border border-success/30 bg-surface-1 p-5 shadow-soft">
          <p class="font-display text-lg font-semibold text-success">
            Batch moja imeundwa · {{ batches.length }} package{{ batches.length > 1 ? 's' : '' }}
          </p>
          @if (issuanceSummary(); as summary) {
            <p class="text-sm text-[var(--text-secondary)]">
              Tayari {{ summary.ready }}/{{ summary.requested }} · Inasubiri {{ summary.pending }} · Imeshindwa {{ summary.failed }}
            </p>
          }
          @for (batch of batches; track batch.id) {
            <div class="border-t border-border pt-3 first:border-t-0 first:pt-0">
              <p class="text-sm text-[var(--text-secondary)]">
                {{ batch.quantity }}× {{ batch.package_name_snapshot }} · TZS
                {{ batch.total_amount | number: '1.0-0' }}
              </p>
              <p class="mt-1 text-xs font-semibold" [class]="packageHasFailure(batch) ? 'text-danger' : 'text-warning'">{{ packageProgress(batch) }}</p>
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
        <div id="agent-directory" class="scroll-mt-6 overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-soft">
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
                    <a [routerLink]="['/admin/agent-batches']" [queryParams]="{ agent: a.id }" class="font-semibold text-signal no-underline hover:text-signal-hover">{{ a.display_name }}</a>
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
                    <a
                      [routerLink]="['/admin/agent-batches']"
                      [queryParams]="{ agent: a.id }"
                      class="mr-3 inline-flex rounded-lg bg-signal px-3 py-2 text-xs font-semibold text-[var(--text-inverse)] no-underline"
                    >View Batches & Print</a>
                    <button
                      type="button"
                      class="mr-3 text-sm font-semibold text-signal hover:text-signal-hover"
                      (click)="loadAssignments(a)"
                    >Assignments</button>
                    @if (auth.isSuperAdmin()) {
                    <button
                      type="button"
                      class="text-sm font-semibold text-signal hover:text-signal-hover"
                      (click)="toggleActive(a)"
                      [disabled]="togglingId() === a.id"
                    >
                      {{ a.is_active ? 'Zima' : 'Washa' }}
                    </button>
                    }
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

      @if (assignmentAgent(); as agent) {
        <div class="rounded-2xl border border-border bg-surface-1 p-5 shadow-soft">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-display text-lg font-semibold">Assignments · {{ agent.display_name }}</h2>
            @if (auth.user()?.role !== 'support') {
              <div class="flex gap-2">
                <select #assignmentSite class="rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm">
                  @for (site of sites(); track site.id) { <option [value]="site.id">{{ site.name }}</option> }
                </select>
                <button type="button" class="font-semibold text-signal" (click)="addAssignment(agent, assignmentSite.value)">Add to site</button>
              </div>
            }
          </div>
          <div class="mt-3 space-y-2">
            @for (assignment of assignments(); track assignment.id) {
              <div class="flex flex-wrap items-center justify-between rounded-lg border border-border p-3 text-sm">
                <span>
                  {{ assignment.site_name }} · <strong>{{ assignment.status }}</strong>
                  <span [class]="assignment.print_permission.enabled ? 'ml-2 text-success' : 'ml-2 text-warning'">
                    Agent PDF Self-Service {{ assignment.print_permission.enabled ? 'ENABLED' : 'DISABLED' }}
                  </span>
                  @if (assignment.print_permission.granted_at) {
                    <small class="mt-1 block text-[var(--text-secondary)]">
                      Granted by {{ assignment.print_permission.granted_by }} · {{ assignment.print_permission.granted_at | date: 'short' }}
                    </small>
                  }
                </span>
                @if (auth.user()?.role !== 'support') {
                  <span class="space-x-3">
                    @if (assignment.status !== 'ended') {
                      <button type="button" [class]="assignment.print_permission.enabled ? 'text-warning' : 'text-success'" (click)="setPrintPermission(agent, assignment, !assignment.print_permission.enabled)">
                        {{ assignment.print_permission.enabled ? 'Disable Agent PDF Printing' : 'Enable Agent PDF Printing' }}
                      </button>
                    }
                    @if (assignment.status === 'active') {
                      <button type="button" class="text-warning" (click)="assignmentAction(assignment, 'suspend')">Suspend</button>
                    } @else if (assignment.status === 'suspended') {
                      <button type="button" class="text-success" (click)="assignmentAction(assignment, 'reactivate')">Reactivate</button>
                    }
                    @if (assignment.status !== 'ended') {
                      <button type="button" class="text-danger" (click)="assignmentAction(assignment, 'end')">End</button>
                    }
                  </span>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Batches -->
      <div>
        <h2 class="font-display text-lg font-semibold text-ink">Batches za agents</h2>
        <p class="mt-1 text-sm text-[var(--text-secondary)]">
          Settle deni kwa batch — au angalia vouchers moja moja chini
        </p>
        <label class="mt-3 block w-full text-xs font-semibold text-[var(--text-secondary)] sm:w-80">Search batches<input type="search" [value]="batchSearch()" (input)="updateBatchSearch($event)" placeholder="Agent, batch, site au package" class="mt-1 block w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm text-ink"></label>
        @if (batchesLoading()) {
          <app-skeleton height="6rem" class="mt-3" />
        } @else if (!batches().length) {
          <p class="mt-3 text-sm text-[var(--text-secondary)]">Hakuna batches.</p>
        } @else {
          <ul class="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface-1">
            @for (group of pagedBatches(); track group.id) {
              <li class="px-4 py-4 text-sm">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-3"><div><p class="font-display font-bold text-ink">Batch {{ group.id.slice(0, 8).toUpperCase() }}</p><p class="text-xs text-[var(--text-secondary)]">{{ group.agentName }} · {{ group.siteName }} · {{ group.totalQuantity }} vouchers · {{ group.createdAt | date:'short' }}</p></div><span class="font-semibold text-signal">TZS {{ group.totalAmount | number:'1.0-0' }}</span></div>
                <div class="space-y-2">
                @for (b of group.lines; track b.id) {
                <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <p class="font-semibold text-ink">
                    {{ b.package_name_snapshot }}
                  </p>
                  <p class="text-xs text-[var(--text-secondary)]">
                    {{ b.quantity }} vouchers
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <a [routerLink]="['/admin/agents', b.agent, 'batches', b.id]" class="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-signal no-underline">View vouchers</a>
                  @if (b.settlement_status === 'unpaid') {
                    <span class="text-sm text-[var(--text-secondary)]">Inasubiri malipo yaliyothibitishwa</span>
                  }
                  <button
                    type="button"
                    class="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-signal disabled:opacity-60"
                    [disabled]="printingId() === b.id"
                    (click)="printBatch(b)"
                  >
                    Print PDF
                  </button>
                </div>
                </div>
                }
                </div>
              </li>
            }
          </ul>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p class="font-medium text-[var(--text-secondary)]">Inaonyesha {{ batchRangeStart() }}-{{ batchRangeEnd() }} kati ya batches {{ filteredBatches().length }}</p>
            <div class="flex items-center gap-2">
              <button type="button" class="rounded-lg border border-border px-3 py-2 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40" [disabled]="batchPage() === 1" (click)="changeBatchPage(-1)">Previous</button>
              <span class="min-w-24 text-center font-semibold text-ink">Page {{ batchPage() }} / {{ batchPageCount() }}</span>
              <button type="button" class="rounded-lg border border-border px-3 py-2 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40" [disabled]="batchPage() === batchPageCount()" (click)="changeBatchPage(1)">Next</button>
            </div>
          </div>
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
        <label class="mt-3 block w-full text-xs font-semibold text-[var(--text-secondary)] sm:w-80">Search vouchers<input type="search" [value]="voucherSearch()" (input)="updateVoucherSearch($event)" placeholder="Voucher, agent, site au package" class="mt-1 block w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm text-ink"></label>
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
                @for (v of pagedVouchers(); track v.id) {
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
          <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p class="font-medium text-[var(--text-secondary)]">Inaonyesha {{ voucherRangeStart() }}-{{ voucherRangeEnd() }} kati ya vouchers {{ filteredVouchers().length }}</p>
            <div class="flex items-center gap-2">
              <button type="button" class="rounded-lg border border-border px-3 py-2 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40" [disabled]="voucherPage() === 1" (click)="changeVoucherPage(-1)">Previous</button>
              <span class="min-w-24 text-center font-semibold text-ink">Page {{ voucherPage() }} / {{ voucherPageCount() }}</span>
              <button type="button" class="rounded-lg border border-border px-3 py-2 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40" [disabled]="voucherPage() === voucherPageCount()" (click)="changeVoucherPage(1)">Next</button>
            </div>
          </div>
        }
      </div>
      @if (agentStatusFilter()) {<div class="flex items-center gap-3 rounded-xl border border-signal/30 bg-signal-muted px-4 py-2 text-sm">Agent status: <strong>{{ agentStatusFilter() }}</strong><a routerLink="/admin/agents" class="text-signal underline">Clear filter</a></div>}

      @if (reasonDialog(); as dialog) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm" (click)="closeReasonDialog()">
          <div role="dialog" aria-modal="true" aria-labelledby="reason-dialog-title" class="w-full max-w-lg rounded-2xl border border-border bg-surface-1 p-6 shadow-2xl" (click)="$event.stopPropagation()">
            <div class="flex items-start gap-4">
              <div [class]="dialog.danger ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger' : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-signal-muted text-signal'">
                <span class="text-xl" aria-hidden="true">{{ dialog.danger ? '!' : '✓' }}</span>
              </div>
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.14em] text-signal">{{ dialog.eyebrow }}</p>
                <h2 id="reason-dialog-title" class="mt-1 font-display text-xl font-bold text-ink">{{ dialog.title }}</h2>
                <p class="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{{ dialog.description }}</p>
              </div>
            </div>
            <label class="mt-5 block">
              <span class="text-sm font-semibold text-ink">Reason <span class="text-danger">*</span></span>
              <textarea rows="4" maxlength="255" [value]="reasonText()" (input)="updateReason($event)" class="mt-2 w-full resize-none rounded-xl border border-border bg-surface-0 px-4 py-3 text-sm text-ink placeholder:text-[var(--text-secondary)] focus:border-signal" placeholder="Eleza sababu kwa ufupi kwa ajili ya audit trail"></textarea>
              <span class="mt-1 flex justify-between text-xs text-[var(--text-secondary)]"><span>{{ reasonError() || 'Minimum characters: 3' }}</span><span>{{ reasonText().length }}/255</span></span>
            </label>
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" class="rounded-xl border border-border px-4 py-2.5 font-semibold text-ink hover:bg-surface-2" [disabled]="reasonBusy()" (click)="closeReasonDialog()">Cancel</button>
              <button type="button" [class]="dialog.danger ? 'rounded-xl bg-danger px-4 py-2.5 font-semibold text-white disabled:opacity-60' : 'rounded-xl bg-signal px-4 py-2.5 font-semibold text-[var(--text-inverse)] disabled:opacity-60'" [disabled]="reasonBusy()" (click)="confirmReasonDialog()">{{ reasonBusy() ? 'Saving…' : dialog.confirmLabel }}</button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class AdminAgentsComponent implements OnInit {
  private readonly api = inject(ApiClient);
  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly sites = signal<SiteOpt[]>([]);
  readonly nodes = signal<NodeOpt[]>([]);
  readonly packages = signal<PackageOpt[]>([]);
  readonly agents = signal<AgentRow[]>([]);
  readonly agentStatusFilter = signal('');
  readonly batches = signal<BatchRow[]>([]);
  readonly groupedBatches = computed(() => {
    const groups = new Map<string, BatchRow[]>();
    for (const batch of this.batches()) { const key=batch.issuance_request || batch.id; groups.set(key,[...(groups.get(key)||[]),batch]); }
    return [...groups.entries()].map(([id,lines])=>({id,lines,agentName:lines[0].agent_name,siteName:lines[0].site_name,createdAt:lines[0].created_at,totalQuantity:lines.reduce((n,x)=>n+x.quantity,0),totalAmount:lines.reduce((n,x)=>n+Number(x.total_amount),0)}));
  });
  readonly batchSearch = signal('');
  readonly filteredBatches = computed(() => {
    const term = this.batchSearch().trim().toLowerCase();
    if (!term) return this.groupedBatches();
    return this.groupedBatches().filter((group) =>
      [group.id, group.agentName, group.siteName, ...group.lines.flatMap((line) => [line.package_name_snapshot, line.node_identifier])]
        .some((value) => String(value || '').toLowerCase().includes(term)),
    );
  });
  readonly batchPage = signal(1);
  readonly batchPageSize = 5;
  readonly batchPageCount = computed(() => Math.max(1, Math.ceil(this.filteredBatches().length / this.batchPageSize)));
  readonly pagedBatches = computed(() => this.filteredBatches().slice((this.batchPage() - 1) * this.batchPageSize, this.batchPage() * this.batchPageSize));
  readonly batchRangeStart = computed(() => this.filteredBatches().length ? (this.batchPage() - 1) * this.batchPageSize + 1 : 0);
  readonly batchRangeEnd = computed(() => Math.min(this.batchPage() * this.batchPageSize, this.filteredBatches().length));
  readonly debts = signal<DebtLedger | null>(null);
  readonly vouchers = signal<VoucherRow[]>([]);
  readonly voucherFilter = signal<'all' | 'unpaid'>('all');
  readonly voucherSearch = signal('');
  readonly filteredVouchers = computed(() => {
    const term = this.voucherSearch().trim().toLowerCase();
    if (!term) return this.vouchers();
    return this.vouchers().filter((voucher) =>
      [voucher.voucher_code, voucher.agent_name, voucher.agent_code, voucher.package_name, voucher.site_name, voucher.provisioning_status]
        .some((value) => String(value || '').toLowerCase().includes(term)),
    );
  });
  readonly voucherPage = signal(1);
  readonly voucherPageSize = 10;
  readonly voucherPageCount = computed(() => Math.max(1, Math.ceil(this.filteredVouchers().length / this.voucherPageSize)));
  readonly pagedVouchers = computed(() => this.filteredVouchers().slice((this.voucherPage() - 1) * this.voucherPageSize, this.voucherPage() * this.voucherPageSize));
  readonly voucherRangeStart = computed(() => this.filteredVouchers().length ? (this.voucherPage() - 1) * this.voucherPageSize + 1 : 0);
  readonly voucherRangeEnd = computed(() => Math.min(this.voucherPage() * this.voucherPageSize, this.filteredVouchers().length));
  readonly loading = signal(true);
  readonly batchesLoading = signal(true);
  readonly vouchersLoading = signal(true);
  readonly creating = signal(false);
  readonly issuing = signal(false);
  readonly togglingId = signal<string | null>(null);
  readonly listError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly formOk = signal<string | null>(null);
  readonly issueError = signal<string | null>(null);
  readonly issueResults = signal<BatchRow[] | null>(null);
  readonly printingId = signal<string | null>(null);
  readonly assignmentAgent = signal<AgentRow | null>(null);
  readonly assignments = signal<AssignmentRow[]>([]);
  readonly reasonDialog = signal<ReasonDialog | null>(null);
  readonly reasonText = signal('');
  readonly reasonError = signal<string | null>(null);
  readonly reasonBusy = signal(false);
  readonly issuanceSummary = signal<IssuanceResponse['summary'] | null>(null);
  private issuanceKey: string | null = null;
  private issuanceId: string | null = null;

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
    receipt_method: ['cash'],
    receipt_received_at: [''],
    receipt_reference: [''],
    receipt_scope: [''],
    receipt_notes: [''],
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
    this.route.queryParamMap.subscribe(params => { this.agentStatusFilter.set(params.get('status') || ''); this.reloadAgents(); });
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
    this.voucherPage.set(1);
    this.reloadVouchers();
  }

  changeBatchPage(offset: number): void {
    this.batchPage.update((page) => Math.min(this.batchPageCount(), Math.max(1, page + offset)));
  }

  updateBatchSearch(event: Event): void {
    this.batchSearch.set((event.target as HTMLInputElement).value);
    this.batchPage.set(1);
  }

  updateVoucherSearch(event: Event): void {
    this.voucherSearch.set((event.target as HTMLInputElement).value);
    this.voucherPage.set(1);
  }

  changeVoucherPage(offset: number): void {
    this.voucherPage.update((page) => Math.min(this.voucherPageCount(), Math.max(1, page + offset)));
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
    const evidence = this.issueForm.getRawValue();
    if (evidence.settlement_mode === 'pay_all') {
      if (!evidence.receipt_received_at || evidence.receipt_notes.trim().length < 3) return false;
      if (evidence.receipt_method !== 'cash' && (evidence.receipt_reference.trim().length < 3 || evidence.receipt_scope.trim().length < 3)) return false;
    }
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
    this.issuanceSummary.set(null);
    this.issuanceKey ||= createIdempotencyKey();
    const v = this.issueForm.getRawValue();
    const lines = (v.lines as { package_id: string; quantity: number }[]).map((l) => ({
      package_id: String(l.package_id),
      quantity: Number(l.quantity),
    }));
    this.api
      .post<IssuanceResponse>(`/admin/agents/${v.agent_id}/issuances/`, {
        agent_id: v.agent_id,
        node_id: v.node_id,
        settlement_mode: v.settlement_mode,
        ...(v.settlement_mode === 'pay_all' ? { receipt: {
          amount: String(this.issueTotal()), currency: 'TZS', payment_method: v.receipt_method,
          received_at: new Date(v.receipt_received_at).toISOString(), notes: v.receipt_notes,
          reference: v.receipt_method === 'cash' ? '' : v.receipt_reference,
          reference_scope: v.receipt_method === 'cash' ? '' : v.receipt_scope,
        }} : {}),
        lines,
      }, { 'Idempotency-Key': this.issuanceKey })
      .subscribe({
        next: (res) => {
          const batches = res.batches ?? [];
          this.issueResults.set(batches);
          this.issuanceSummary.set(res.summary);
          this.issuanceId = res.id;
          this.issuanceKey = null;
          this.issuing.set(false);
          this.reloadBatches();
          this.reloadDebts();
          this.reloadVouchers();
          this.reloadAgents();
          setTimeout(() => this.refreshIssuance(), 1500);
        },
        error: (err: unknown) => {
          this.issueError.set(err instanceof AppError ? err.message : this.errMsg(err));
          this.issuing.set(false);
        },
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

  packageProgress(batch: BatchRow): string {
    const items=batch.items || []; const ready=items.filter(x=>x.provisioning_status==='success').length; const failed=items.filter(x=>x.provisioning_status==='failed').length;
    return failed ? `${ready}/${batch.quantity} ready · ${failed} failed` : ready===batch.quantity ? `${ready}/${batch.quantity} ready` : `${ready}/${batch.quantity} provisioning in background`;
  }
  packageHasFailure(batch: BatchRow): boolean { return (batch.items || []).some(x=>x.provisioning_status==='failed'); }

  loadAssignments(agent: AgentRow): void {
    this.assignmentAgent.set(agent);
    this.api.get<AssignmentRow[]>(`/admin/agents/${agent.id}/assignments/`).subscribe({
      next: (rows) => this.assignments.set(Array.isArray(rows) ? rows : []),
    });
  }

  addAssignment(agent: AgentRow, siteId: string): void {
    if (!siteId) return;
    this.api.post<AssignmentRow>(`/admin/agents/${agent.id}/assignments/`, { site_id: siteId }).subscribe({
      next: () => { this.loadAssignments(agent); this.reloadAgents(); },
      error: (err: unknown) => this.issueError.set(err instanceof AppError ? err.message : this.errMsg(err)),
    });
  }

  assignmentAction(assignment: AssignmentRow, action: 'suspend' | 'reactivate' | 'end'): void {
    if (action === 'reactivate') {
      this.executeAssignmentAction(assignment, action, '');
      return;
    }
    this.openReasonDialog({
      eyebrow: 'Assignment control',
      title: action === 'suspend' ? 'Suspend this assignment?' : 'End this assignment?',
      description: action === 'suspend'
        ? 'Agent access to this site will be paused until an administrator reactivates it.'
        : 'This closes the assignment. Historical batches and audit records will remain available.',
      confirmLabel: action === 'suspend' ? 'Suspend assignment' : 'End assignment',
      danger: true,
      submit: (reason) => this.executeAssignmentAction(assignment, action, reason),
    });
  }

  private executeAssignmentAction(assignment: AssignmentRow, action: 'suspend' | 'reactivate' | 'end', reason: string): void {
    this.reasonBusy.set(true);
    this.api.post<AssignmentRow>(`/admin/agent-assignments/${assignment.id}/${action}/`, { reason }).subscribe({
      next: () => {
        this.finishReasonDialog();
        const agent = this.assignmentAgent();
        if (agent) this.loadAssignments(agent);
        this.reloadAgents();
      },
      error: (err: unknown) => {
        this.reasonBusy.set(false);
        const message = err instanceof AppError ? err.message : this.errMsg(err);
        if (this.reasonDialog()) this.reasonError.set(message);
        else this.issueError.set(message);
      },
    });
  }

  setPrintPermission(agent: AgentRow, assignment: AssignmentRow, enabled: boolean): void {
    this.openReasonDialog({
      eyebrow: 'PDF access control',
      title: enabled ? 'Enable voucher PDF printing?' : 'Disable voucher PDF printing?',
      description: enabled
        ? `${agent.display_name} will be allowed to generate and download credential-bearing PDFs for ${assignment.site_name}.`
        : `${agent.display_name} will immediately lose generation and authenticated download access for ${assignment.site_name}. Historical print records will remain.`,
      confirmLabel: enabled ? 'Enable PDF printing' : 'Disable PDF printing',
      danger: !enabled,
      submit: (reason) => {
        this.reasonBusy.set(true);
        const action = enabled ? 'grant' : 'revoke';
        this.api.post(`/admin/agents/${agent.id}/print-permissions/${assignment.site}/${action}/`, { reason }).subscribe({
          next: () => { this.finishReasonDialog(); this.loadAssignments(agent); },
          error: (err: unknown) => { this.reasonBusy.set(false); this.reasonError.set(err instanceof AppError ? err.message : this.errMsg(err)); },
        });
      },
    });
  }

  updateReason(event: Event): void {
    this.reasonText.set((event.target as HTMLTextAreaElement).value);
    this.reasonError.set(null);
  }

  confirmReasonDialog(): void {
    const reason = this.reasonText().trim();
    if (reason.length < 3) {
      this.reasonError.set('Weka sababu yenye angalau herufi 3.');
      return;
    }
    this.reasonDialog()?.submit(reason);
  }

  closeReasonDialog(): void {
    if (this.reasonBusy()) return;
    this.finishReasonDialog();
  }

  private openReasonDialog(dialog: ReasonDialog): void {
    this.reasonText.set('');
    this.reasonError.set(null);
    this.reasonBusy.set(false);
    this.reasonDialog.set(dialog);
  }

  private finishReasonDialog(): void {
    this.reasonBusy.set(false);
    this.reasonDialog.set(null);
    this.reasonText.set('');
    this.reasonError.set(null);
  }

  private refreshIssuance(): void {
    if (!this.issuanceId) return;
    this.api.get<IssuanceResponse>(`/admin/agent-issuances/${this.issuanceId}/`).subscribe({
      next: (result) => {
        this.issueResults.set(result.batches ?? []);
        this.issuanceSummary.set(result.summary);
        if (result.summary.pending > 0) setTimeout(() => this.refreshIssuance(), 2000);
      },
    });
  }

  private reloadAgents(): void {
    this.loading.set(true);
    this.api.get<AgentRow[]>('/admin/agents/', { status: this.agentStatusFilter() }).subscribe({
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
        this.batchPage.set(1);
        this.batchesLoading.set(false);
      },
      error: () => this.batchesLoading.set(false),
    });
  }

  printBatch(batch: BatchRow): void {
    this.printingId.set(batch.id);
    this.api.get<PrintInfo>(`/admin/agent-batches/${batch.id}/print/`).subscribe({
      next: (info) => {
        if (!info.eligibility.eligible) { this.printingId.set(null); return; }
        if (info.history.length) {
          this.printingId.set(null);
          this.openReasonDialog({
            eyebrow: 'Controlled reprint',
            title: `Reprint batch ${batch.id.slice(0, 8).toUpperCase()}?`,
            description: 'A new immutable print version will be created. The previous PDF and its audit history will not be changed.',
            confirmLabel: 'Create reprint',
            danger: false,
            submit: (reason) => this.createPrint(batch, reason),
          });
        } else {
          this.createPrint(batch, '');
        }
      },
      error: () => this.printingId.set(null),
    });
  }

  private createPrint(batch: BatchRow, reason: string): void {
    this.reasonBusy.set(true);
    this.printingId.set(batch.id);
    this.api.post<PrintJob>(`/admin/agent-batches/${batch.id}/print/`, { reprint_reason: reason }, { 'Idempotency-Key': createIdempotencyKey() }).subscribe({
      next: (job) => { this.printingId.set(null); this.finishReasonDialog(); this.downloadPrint(job.id); },
      error: (err: unknown) => {
        this.printingId.set(null);
        this.reasonBusy.set(false);
        const message = err instanceof AppError ? err.message : this.errMsg(err);
        if (this.reasonDialog()) this.reasonError.set(message);
        else this.issueError.set(message);
      },
    });
  }

  private downloadPrint(jobId: string): void {
    this.api.download(`/admin/voucher-print-jobs/${jobId}/download/`).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `bitech-vouchers-${jobId}.pdf`; link.click();
      URL.revokeObjectURL(url);
    });
  }

  private reloadDebts(): void {
    this.api.get<DebtLedger>('/admin/agent-debts/').subscribe({
      next: (data) => this.debts.set(data),
    });
  }

  private reloadVouchers(): void {
    this.vouchersLoading.set(true);
    const params: Record<string, string> = { limit: '500' };
    if (this.voucherFilter() === 'unpaid') params['unpaid'] = 'true';
    this.api.get<VoucherRow[]>('/admin/agent-vouchers/', params).subscribe({
      next: (data) => {
        this.vouchers.set(Array.isArray(data) ? data : []);
        this.voucherPage.set(1);
        this.vouchersLoading.set(false);
      },
      error: () => this.vouchersLoading.set(false),
    });
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : 'Hitilafu.';
  }
}
