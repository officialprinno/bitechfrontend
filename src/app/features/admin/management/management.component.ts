import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { ApiClient, PageResult, QueryParams } from '../../../core/api/api-client';
import { MANAGEMENT, ManagementConfig } from './management.config';

type Row = Record<string, any>;
@Component({
  selector: 'app-management',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  template: ` <section class="workspace">
    <header class="page-heading">
      <div>
        <p class="eyebrow">BITECH / ADMINISTRATION</p>
        <h1>{{ config.title }}</h1>
        <p>{{ config.description }}</p>
      </div>
      <div class="heading-actions">
        @if (resource === 'nodes') {
          <a routerLink="/admin/nodes/health">Router health &amp; remote access</a>
        }
        @if (config.fields) {
          <button class="primary" (click)="edit()">
            Create
            {{
              resource === 'agents'
                ? 'agent'
                : resource === 'sites'
                  ? 'site'
                  : resource === 'nodes'
                    ? 'node'
                    : 'package'
            }}
          </button>
        }
        @if (resource === 'agent-assignments') {
          <button class="primary" (click)="assignmentForm()">Assign site</button>
        }
        @if (resource === 'agents') {
          <a routerLink="/admin/agents/issue">Issue vouchers</a>
        }
      </div>
    </header>
    <form class="filters" (ngSubmit)="apply()">
      <label class="search"
        >Search<input name="search" [(ngModel)]="search" placeholder="Search these records"
      /></label>
      @if (config.statuses) {
        <label
          >Status<select name="status" [(ngModel)]="status">
            <option value="">All statuses</option>
            @for (s of config.statuses; track s) {
              <option [value]="s">{{ label(s) }}</option>
            }
          </select></label
        >
      }
      @if (resource === 'sms-logs' || resource === 'webhook-events') {
        <label
          >Provider<input name="provider" [(ngModel)]="provider" placeholder="All providers"
        /></label>
      }
      @if (resource === 'sms-logs') {
        <label
          >Category<input name="category" [(ngModel)]="category" placeholder="All categories"
        /></label>
      }
      <label>From<input name="from" type="date" [(ngModel)]="from" /></label
      ><label>To<input name="to" type="date" [(ngModel)]="to" /></label>
      <label
        >Order<select name="sort" [(ngModel)]="sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select></label
      >
      <button class="primary" type="submit">Apply filters</button
      ><button type="button" (click)="clear()">Clear</button>
    </form>
    @if (params['agent'] || params['site'] || params['object']) {
      <p class="filter-note">
        Scoped view ·
        {{
          params['agent'] ? 'Selected agent' : params['site'] ? 'Selected site' : 'Selected record'
        }}
        · <button (click)="clear()">Show all records</button>
      </p>
    }
    @if (error()) {
      <div class="error" role="alert">
        {{ error() }} <button (click)="load()">Try again</button>
      </div>
    }
    @if (notice()) {
      <p class="notice" role="status">{{ notice() }}</p>
    }

    @if (editor) {
      <section #activePanel class="editor" aria-labelledby="edit-heading" tabindex="-1">
        <div class="section-heading">
          <h2 id="edit-heading">
            {{
              assignment ? 'Assign an agent to a site' : resource === 'nodes' ? (editingId ? 'Edit node' : 'Create node') : editingId ? 'Edit record' : 'Create record'
            }}
          </h2>
          <button (click)="closeEditor()">Cancel</button>
        </div>
        @if (resource === 'nodes' && editingId) {
          <p class="help">{{ draft['display_name'] || draft['node_identifier'] }} · {{ draft['node_identifier'] }}</p>
        }
        <label
          >Find site, node or agent choices<input
            [(ngModel)]="pickerSearch"
            placeholder="Search by name" /></label
        ><button type="button" (click)="options()">Search choices</button>
        <p class="help">Up to 100 matching choices. Refine the search to find another record.</p>
        <form #recordForm="ngForm" (ngSubmit)="recordForm.valid && save()">
          <div class="field-grid">
            @if (assignment) {
              <label
                >Agent<select name="agent_id" [(ngModel)]="draft['agent_id']" required>
                  <option value="">Select agent</option>
                  @for (a of agents(); track a['id']) {
                    <option [value]="a['id']">{{ a['display_name'] }}</option>
                  }
                </select></label
              ><label
                >Site<select name="site_id" [(ngModel)]="draft['site_id']" required>
                  <option value="">Select site</option>
                  @for (s of sites(); track s['id']) {
                    <option [value]="s['id']">{{ s['name'] }}</option>
                  }
                </select></label
              ><label
                >Notes<input name="notes" [(ngModel)]="draft['notes']" maxlength="255"
              /></label>
            } @else {
              @for (f of config.fields; track f.key) {
                @if (
                  !(
                    editingId &&
                    resource === 'agents' &&
                    ['username', 'site_ids', 'password'].includes(f.key)
                  )
                ) {
                  <label
                    >{{ f.label }}
                    @if (f.type === 'site' || f.type === 'node') {
                      <select [name]="f.key" [(ngModel)]="draft[f.key]" [required]="!!f.required">
                        <option value="">Select {{ f.type }}</option>
                        @for (o of f.type === 'site' ? sites() : nodes(); track o['id']) {
                          <option [value]="o['id']">
                            {{ o['name'] || o['display_name'] || o['node_identifier'] }}
                          </option>
                        }
                      </select>
                    } @else {
                      <input
                        [name]="f.key"
                        [attr.name]="f.key"
                        [type]="f.type || 'text'"
                        [(ngModel)]="draft[f.key]"
                        [required]="!!f.required"
                        [attr.autocomplete]="f.type === 'password' ? 'new-password' : null"
                      />
                      @if (resource === 'nodes' && editingId && f.key === 'api_password') {
                        <span class="help">Leave blank to keep the current API password.</span>
                      }
                    }
                  </label>
                }
              }
            }
          </div>
          <p class="help">
            Site and node changes are validated by the server. Existing commercial history is
            preserved.
          </p>
          <button class="primary" type="submit" [disabled]="saving() || recordForm.invalid">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
        </form>
      </section>
    }

    @if (command) {
      <section class="editor" aria-labelledby="confirm-heading">
        <h2 id="confirm-heading">Confirm {{ label(command) }}</h2>
        <p>
          Record:
          {{
            target?.['display_name'] ||
              target?.['username'] ||
              target?.['agent_name'] ||
              target?.['id']
          }}
        </p>
        <form (ngSubmit)="confirm()">
          <label
            >Reason<textarea name="reason" [(ngModel)]="reason" required maxlength="255"></textarea>
          </label>
          @if (command === 'set_password') {
            <label
              >New password<input
                name="password"
                type="password"
                autocomplete="new-password"
                [(ngModel)]="password"
                required
                minlength="8"
            /></label>
          }
          <div class="heading-actions">
            <button class="primary" [disabled]="saving()">Confirm {{ label(command) }}</button
            ><button type="button" (click)="command = ''">Cancel</button>
          </div>
        </form>
      </section>
    }

    <div class="record-count">
      <strong>{{ result()?.count ?? 0 }}</strong> records
      <span>{{ loading() ? 'Updating…' : 'Server-paginated results' }}</span>
    </div>
    <div class="table-wrap" [attr.aria-busy]="loading()">
      <table>
        <thead>
          <tr>
            @for (c of config.columns; track c) {
              <th scope="col">{{ resource==='agents' ? agentColumn(c) : label(c) }}</th>
            }
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (row of result()?.rows || []; track row['id']) {
            <tr>
              @for (c of config.columns; track c) {
                <td>
                  @if(resource==='agents' && c==='display_name'){
                    <a class="block font-semibold" [routerLink]="['/admin/agents',row['id']]">{{ row['display_name'] }}</a>
                    <span class="mt-1 block text-xs text-[var(--text-secondary)]">{{ row['phone_number'] || 'No phone number' }}</span>
                  } @else if(resource==='agents' && c==='inventory_count'){
                    <strong>{{ row['inventory_count'] }} vouchers</strong>
                    <span class="mt-1 block text-xs text-[var(--text-secondary)]">{{ row['batches_count'] }} batches · {{ row['active_assignments'] }} active sites</span>
                  } @else if (c.includes('status') || c === 'is_active') {
                    <span class="badge" [attr.data-state]="row[c]">{{ display(row[c]) }}</span>
                  } @else {
                    {{ display(row[c]) }}
                  }
                </td>
              }
              <td>
                <div class="row-actions">
                  @if (resource === 'nodes') {
                    <a routerLink="/admin/nodes/health" [queryParams]="{ node: row['node_identifier'] }">Remote Management</a>
                  }
                  @if (resource === 'agents') {
                    <a [routerLink]="['/admin/agents', row['id']]">Open agent →</a>
                    <details class="w-full text-xs"><summary class="cursor-pointer py-2 font-semibold">Manage account</summary><div class="flex flex-wrap gap-2 py-2">
                    <button (click)="edit(row)">Edit details</button>
                    @if(row['account_status']==='active'){<button (click)="ask(row,'suspend')">Suspend</button>}
                    @if(row['account_status']!=='disabled'){<button (click)="ask(row,'disable')">Disable</button>}
                    @if(row['account_status']!=='active'){<button (click)="ask(row,'reactivate')">Reactivate</button>}
                    <button (click)="ask(row,'set_password')">Set password</button>
                    </div></details>
                  } @else if (resource === 'users') {
                    @if (row['agent_id']) {
                      <a [routerLink]="['/admin/agents', row['agent_id']]">Manage agent</a>
                    } @else {
                      <button
                        (click)="ask(row, row['status'] === 'disabled' ? 'reactivate' : 'disable')"
                      >
                        {{ row['status'] === 'disabled' ? 'Reactivate' : 'Disable' }}</button
                      ><button (click)="ask(row, 'set_password')">Set password</button>
                    }
                  } @else if (resource === 'agent-assignments') {
                    @if (row['status'] === 'active') {
                      <button (click)="ask(row, 'suspend')">Suspend</button>
                    }
                    @if (row['status'] === 'suspended') {
                      <button (click)="ask(row, 'reactivate')">Reactivate</button>
                    }
                    @if (row['status'] !== 'ended') {
                      <button (click)="ask(row, 'end')">End assignment</button>
                    }
                    <a [routerLink]="['/admin/agents', row['agent']]">Agent</a>
                  } @else {
                    <button (click)="open(row)">Details</button>
                  }
                  @if (config.fields && resource!=='agents') {
                    <button (click)="edit(row)">Edit</button>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td [attr.colspan]="config.columns.length + 1" class="empty">
                {{ loading() ? 'Loading records…' : 'No records match these filters.' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <nav class="pagination" aria-label="Record pages">
      <span>Page {{ result()?.page || 1 }}</span
      ><button [disabled]="loading() || (result()?.page || 1) <= 1" (click)="move(-1)">
        Previous</button
      ><button [disabled]="loading() || !result()?.next" (click)="move(1)">Next</button>
    </nav>

    @if (detail(); as d) {
      <section #activePanel class="editor" aria-labelledby="detail-heading" tabindex="-1">
        <div class="section-heading">
          <h2 id="detail-heading">{{ resource === 'nodes' ? 'Node details' : 'Record details' }}</h2>
          <button (click)="closeDetail()">Close</button>
        </div>
        @if (resource === 'nodes') {
          <p class="help">Read-only overview · {{ d['display_name'] || d['node_identifier'] }}</p>
        }
        <dl class="field-grid">
          @for (c of config.columns; track c) {
            <div>
              <dt>{{ label(c) }}</dt>
              <dd>{{ display(d[c]) }}</dd>
            </div>
          }
        </dl>
        @if (d['summary']) {
          <dl class="field-grid">
            @for (key of ['requested', 'ready', 'pending', 'failed']; track key) {
              <div>
                <dt>{{ label(key) }}</dt>
                <dd>{{ d['summary'][key] ?? '—' }}</dd>
              </div>
            }
          </dl>
        }
        @if (d['batches']) {
          <h3>Related batches</h3>
          @for (b of d['batches']; track b.id) {
            <a class="related" [routerLink]="['/admin/agents', d['agent'], 'batches', b.id]"
              >{{ b.package_name_snapshot }} · {{ b.quantity }} vouchers → Open batch & PDF</a
            >
          }
        }
        @if (d['operational_summary']) {
          <h3>Operational summary</h3>
          <dl class="field-grid">
            @for (
              key of [
                'nodes',
                'packages',
                'active_assignments',
                'vouchers',
                'offline_nodes',
                'open_router_jobs',
              ];
              track key
            ) {
              @if (d['operational_summary'][key] !== undefined) {
                <div>
                  <dt>{{ label(key) }}</dt>
                  <dd>{{ d['operational_summary'][key] }}</dd>
                </div>
              }
            }
          </dl>
        }
        @if (resource === 'customers') {
          <h3>Purchases</h3>
          @for (p of purchases()?.rows || []; track p['id']) {
            <a
              class="related"
              routerLink="/admin/operations"
              [queryParams]="{ tab: 'payments', payment: p['id'] }"
              >{{ p['created_at'] | date: 'medium' }} · {{ p['package'] }} · {{ p['status'] }} ·
              {{ p['site'] }}</a
            >
          }
          <button [disabled]="purchasePage <= 1" (click)="loadPurchases(-1)">
            Previous purchases</button
          ><button [disabled]="!purchases()?.next" (click)="loadPurchases(1)">
            Next purchases
          </button>
        }
        @if (d['payment_id']) {
          <a
            routerLink="/admin/operations"
            [queryParams]="{ tab: 'payments', payment: d['payment_id'] }"
            >Open payment</a
          >
        }
      </section>
    }
  </section>`,
  styleUrl: './management.css',
})
export class ManagementComponent implements OnInit {
  @ViewChild('activePanel') set activePanel(panel: ElementRef<HTMLElement> | undefined) {
    if (panel) {
      panel.nativeElement.focus({ preventScroll: true });
      panel.nativeElement.scrollIntoView({ block: 'start' });
    }
  }
  agentColumn(key:string):string { return ({display_name:'Agent',account_status:'Status',inventory_count:'Inventory',last_login:'Last sign-in'} as Record<string,string>)[key] || this.label(key); }
  private api = inject(ApiClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroy = inject(DestroyRef);
  resource = '';
  config!: ManagementConfig;
  params: QueryParams = {};
  search = '';
  status = '';
  from = '';
  to = '';
  sort = 'newest';
  result = signal<PageResult<Row> | null>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  notice = signal('');
  detail = signal<Row | null>(null);
  purchases = signal<PageResult<Row> | null>(null);
  purchasePage = 1;
  sites = signal<Row[]>([]);
  nodes = signal<Row[]>([]);
  agents = signal<Row[]>([]);
  pickerSearch = '';
  provider = '';
  category = '';
  editor = false;
  editingId = '';
  assignment = false;
  draft: Row = {};
  command = '';
  reason = '';
  password = '';
  target: Row | null = null;
  private listRequest?: Subscription;
  private detailRequest?: Subscription;
  ngOnInit() {
    combineLatest([this.route.data, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(([data, p]) => {
        if (this.resource !== data['resource']) {
          this.closeEditor();
          this.command = '';
          this.notice.set('');
        }
        this.resource = data['resource'];
        this.config = MANAGEMENT[this.resource];
        this.params = {};
        p.keys.forEach((k) => (this.params[k] = p.get(k)));
        this.search = p.get('search') || '';
        this.status = p.get('status') || '';
        this.from = p.get('from') || '';
        this.to = p.get('to') || '';
        this.sort = p.get('sort') || 'newest';
        this.provider = p.get('provider') || '';
        this.category = p.get('category') || '';
        this.load();
        this.detailRequest?.unsubscribe();
        this.detail.set(null);
        if (p.get('record')) this.fetchDetail(p.get('record')!);
      });
  }
  load() {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    const params: QueryParams = {
      ...this.params,
      ordering: this.sort === 'oldest' ? 'created_at' : '-created_at',
      page: this.params['page'] || 1,
      page_size: 25,
    };
    if (['sites', 'packages'].includes(this.resource)) {
      params['is_active'] = this.status ? this.status === 'active' : null;
      delete params['status'];
    }
    if (this.resource === 'nodes') {
      params['health_status'] = this.status;
      params['is_active'] = this.status ? 'true' : null;
      delete params['status'];
    }
    this.listRequest = this.api
      .getPage<Row>(this.config.endpoint, params)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.result.set(r);
          this.loading.set(false);
        },
        error: (e) => {
          this.result.set(null);
          this.loading.set(false);
          this.error.set(e.message || 'Unable to load records.');
        },
      });
  }
  apply() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...this.params,
        search: this.search || null,
        status: this.status || null,
        provider: this.provider || null,
        category: this.category || null,
        from: this.from || null,
        to: this.to || null,
        sort: this.sort,
        page: 1,
        record: null,
      },
    });
  }
  clear() {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }
  move(delta: number) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.params, page: (this.result()?.page || 1) + delta, record: null },
    });
  }
  label(s: string) {
    return s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  display(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object') return 'Details available';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v))
      return new Date(v).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' });
    return String(v);
  }
  open(row: Row) {
    this.closeEditor();
    this.command = '';
    // Angular ignores navigation to the current URL. Reopen details explicitly
    // when Edit was opened from this record's existing details URL.
    if (this.params['record'] === row['id']) {
      this.detailRequest?.unsubscribe();
      this.detail.set(null);
      this.fetchDetail(row['id']);
      return;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.params, record: row['id'] },
    });
  }
  closeDetail() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.params, record: null },
    });
  }
  fetchDetail(id: string) {
    this.closeEditor();
    this.detailRequest = this.api
      .get<Row>(`${this.config.endpoint}${encodeURIComponent(id)}/`)
      .subscribe({
        next: (d) => {
          this.detail.set(d);
          if (this.resource === 'customers') {
            this.purchasePage = 1;
            this.loadPurchases();
          }
        },
        error: (e) => this.error.set(e.message),
      });
  }
  loadPurchases(delta = 0) {
    this.purchasePage += delta;
    this.api
      .getPage<Row>(`/admin/customers/${this.detail()?.['id']}/purchases/`, {
        page: this.purchasePage,
        page_size: 10,
      })
      .subscribe({ next: (r) => this.purchases.set(r), error: (e) => this.error.set(e.message) });
  }
  options() {
    this.api
      .getPage<Row>('/admin/sites/', { page: 1, page_size: 100, search: this.pickerSearch })
      .subscribe((r) => this.sites.set(r.rows));
    this.api
      .getPage<Row>('/admin/nodes/', { page: 1, page_size: 100, search: this.pickerSearch })
      .subscribe((r) => this.nodes.set(r.rows));
    if (this.assignment)
      this.api
        .getPage<Row>('/admin/agents/', { page: 1, page_size: 100, search: this.pickerSearch })
        .subscribe((r) => this.agents.set(r.rows));
  }
  edit(row?: Row) {
    this.detailRequest?.unsubscribe();
    this.detail.set(null);
    this.command = '';
    this.error.set('');
    this.notice.set('');
    this.assignment = false;
    this.editingId = row?.['id'] || '';
    this.draft = { is_active: true, use_ssl: false, api_port: 8728, sort_order: 0, ...row };
    delete this.draft['api_password'];
    delete this.draft['password'];
    this.editor = true;
    this.options();
  }
  assignmentForm() {
    this.assignment = true;
    this.editor = true;
    this.editingId = '';
    this.draft = { agent_id: this.params['agent'] || '', site_id: this.params['site'] || '' };
    this.options();
  }
  closeEditor() {
    this.editor = false;
    this.draft = {};
    this.editingId = '';
  }
  save() {
    if (this.saving()) return;
    let body: Row = {};
    let path = this.config.endpoint;
    if (this.assignment) {
      path = `/admin/agents/${this.draft['agent_id']}/assignments/`;
      body = { site_id: this.draft['site_id'], notes: this.draft['notes'] || '' };
    } else
      for (const f of this.config.fields || []) {
        if (
          this.editingId &&
          this.resource === 'agents' &&
          ['username', 'site_ids', 'password'].includes(f.key)
        )
          continue;
        const v = this.draft[f.key];
        if (f.type === 'password' && !v) continue;
        body[f.key] =
          f.key === 'site_ids'
            ? [v]
            : (f.key === 'node' || f.key === 'data_limit_mb') && !v
              ? null
              : v;
      }
    this.saving.set(true);
    this.error.set('');
    const req = this.editingId
      ? this.api.patch(path + this.editingId + '/', body)
      : this.api.post(path, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEditor();
        this.notice.set('Changes saved.');
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(this.validationMessage(e));
      },
    });
  }
  ask(row: Row, action: string) {
    this.target = row;
    this.command = action;
    this.reason = '';
    this.password = '';
  }
  validationMessage(error: { message?: string; details?: unknown }): string {
    const details = error.details;
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      const fields = Object.entries(details).flatMap(([key, value]) =>
        typeof value === 'string'
          ? [`${this.label(key)}: ${value}`]
          : Array.isArray(value)
            ? value.filter((v) => typeof v === 'string').map((v) => `${this.label(key)}: ${v}`)
            : [],
      );
      if (fields.length) return fields.join(' ');
    }
    return error.message || 'Unable to save changes. Please try again.';
  }
  confirm() {
    if (this.saving() || !this.reason.trim() || !this.target) return;
    this.saving.set(true);
    let path = '';
    if (this.resource === 'agents') path = `/admin/agents/${this.target['id']}/actions/`;
    else if (this.resource === 'users') path = `/admin/users/${this.target['id']}/actions/`;
    else path = `/admin/agent-assignments/${this.target['id']}/${this.command}/`;
    this.api
      .post(path, {
        action: this.command,
        reason: this.reason,
        password: this.command === 'set_password' ? this.password : undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.command = '';
          this.password = '';
          this.notice.set('Action completed.');
          this.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(this.validationMessage(e));
        },
      });
  }
}
