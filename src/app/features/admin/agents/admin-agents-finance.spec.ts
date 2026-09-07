import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NEVER } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { AuthService } from '../../../core/auth/auth.service';
import { AdminAgentsComponent } from './admin-agents.component';

describe('Agent issuance receipt evidence', () => {
  let component: AdminAgentsComponent;
  let post: jasmine.Spy;
  beforeEach(() => {
    post = jasmine.createSpy('post').and.returnValue(NEVER);
    TestBed.configureTestingModule({ providers: [FormBuilder,
      { provide: ApiClient, useValue: { post } },
      { provide: AuthService, useValue: {} },
      { provide: ActivatedRoute, useValue: {} },
    ] });
    component = TestBed.runInInjectionContext(() => new AdminAgentsComponent());
    component.issueForm.patchValue({ agent_id: 'agent-id', node_id: 'node-id' });
    component.issueLines.at(0).patchValue({ package_id: 'package-id', quantity: 2 });
    component.packages.set([{ id: 'package-id', site: 'site-id', name: 'Package', price_tzs: '1000', is_active: true, node: 'node-id' }]);
  });

  it('requires actual receipt evidence for prepaid issuance', () => {
    expect(component.canIssue()).toBeFalse();
    component.issueForm.patchValue({ receipt_received_at: '2026-09-01T10:00', receipt_notes: 'Cash counted and received' });
    expect(component.canIssue()).toBeTrue();
    component.issueForm.patchValue({ receipt_method: 'bank_transfer' });
    expect(component.canIssue()).toBeFalse();
    component.issueForm.patchValue({ receipt_reference: 'BANK123', receipt_scope: 'Bank account A' });
    expect(component.canIssue()).toBeTrue();
  });

  it('submits receipt separately from issuance lines', () => {
    component.issueForm.patchValue({ receipt_received_at: '2026-09-01T10:00', receipt_notes: 'Verified bank receipt',
      receipt_method: 'bank_transfer', receipt_reference: 'BANK123', receipt_scope: 'Bank account A' });
    component.issue();
    const payload = post.calls.mostRecent().args[1];
    expect(payload.receipt.amount).toBe('2000');
    expect(payload.receipt.reference).toBe('BANK123');
    expect(payload.receipt.received_at).toBe(new Date('2026-09-01T10:00').toISOString());
    expect(payload.lines.length).toBe(1);
  });

  it('credit issuance never invents a receipt', () => {
    component.issueForm.patchValue({ settlement_mode: 'unpaid_recorded' });
    expect(component.canIssue()).toBeTrue();
    component.issue();
    expect(post.calls.mostRecent().args[1].receipt).toBeUndefined();
  });
});
