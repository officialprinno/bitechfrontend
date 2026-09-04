import { CheckoutAttempt } from './portal-checkout.component';

describe('CheckoutAttempt', () => {
  it('creates one idempotency key and reuses it for an uncertain retry', () => {
    const attempt = new CheckoutAttempt();
    expect(attempt.idempotencyKey()).toBe(attempt.idempotencyKey());
    expect(attempt.idempotencyKey().length).toBeGreaterThanOrEqual(16);
  });

  it('creates a new key for a genuinely new purchase', () => {
    const first = new CheckoutAttempt().idempotencyKey();
    const second = new CheckoutAttempt().idempotencyKey();
    expect(second).not.toBe(first);
  });
});
