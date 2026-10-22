import { Plan, SubscriptionStatus } from '@scanflow/types';

export interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  entitlement_ids?: string[];
}

export interface MappedSubscription {
  plan: Plan;
  status: SubscriptionStatus;
  expiresAt: Date | null;
  productId: string | null;
  appUserId: string | null;
}

export function planFromProduct(productId: string | undefined): Plan {
  const id = (productId ?? '').toLowerCase();
  if (id.includes('business')) return Plan.BUSINESS;
  if (id.includes('premium') || id.includes('pro')) return Plan.PREMIUM;
  return Plan.FREE;
}

export function mapRevenueCatEvent(event: RevenueCatEvent): MappedSubscription {
  const type = (event.type ?? '').toUpperCase();
  let status: SubscriptionStatus = SubscriptionStatus.ACTIVE;
  if (type === 'CANCELLATION') status = SubscriptionStatus.CANCELED;
  else if (type === 'EXPIRATION') status = SubscriptionStatus.EXPIRED;
  else if (type === 'BILLING_ISSUE') status = SubscriptionStatus.PAST_DUE;
  else if (type === 'INITIAL_PURCHASE' || type === 'RENEWAL' || type === 'UNCANCELLATION' || type === 'PRODUCT_CHANGE') {
    status = SubscriptionStatus.ACTIVE;
  }
  const expiresAt =
    typeof event.expiration_at_ms === 'number' ? new Date(event.expiration_at_ms) : null;
  return {
    plan: status === SubscriptionStatus.EXPIRED ? Plan.FREE : planFromProduct(event.product_id),
    status,
    expiresAt,
    productId: event.product_id ?? null,
    appUserId: event.app_user_id ?? null,
  };
}

export function planFromSubscriberPayload(payload: unknown, productId: string): Plan {
  if (!payload || typeof payload !== 'object') return Plan.FREE;
  const subscriber = (payload as { subscriber?: { entitlements?: Record<string, { product_identifier?: string; expires_date?: string | null }> } }).subscriber;
  const entitlements = subscriber?.entitlements ?? {};
  const active = Object.values(entitlements).some((entitlement) => {
    if (entitlement.product_identifier && entitlement.product_identifier !== productId && productId) {
      return false;
    }
    if (!entitlement.expires_date) return true;
    return new Date(entitlement.expires_date).getTime() > Date.now();
  });
  if (!active && productId) return planFromProduct(productId);
  return active ? planFromProduct(productId) : Plan.FREE;
}
