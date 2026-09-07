export type EventStage =
  "transport" | "identity" | "gateway" | "vault" | "database" | "policy";
export type EventStatus = "allowed" | "denied" | "error" | "ok";

export interface SecurityEvent {
  id: string;
  at: string;
  stage: EventStage;
  status: EventStatus;
  action: string;
  requestId: string;
  latencyMs?: number;
}

export interface OrderStatus {
  order_id: string;
  payment_status: string;
  delivery_status: string;
  updated_at: string;
}

export interface OrderLookupFound extends OrderStatus {
  status: "found";
}

export interface OrderLookupUnavailable {
  status: "not_found_or_unauthorized";
}

export type OrderLookup = OrderLookupFound | OrderLookupUnavailable;

export type OrderStatusResult = OrderLookup & { access: AccessMetadata };

export interface AccessMetadata {
  nhi: string;
  user_subject?: string;
  verify: "authenticated";
  vault: "authorized";
  credential_type: "dynamic";
  credential_ttl_seconds: number;
  access_tier?: "orders-full" | "orders-limited";
}

export interface FailedPaymentSummary {
  date: string;
  failed_count: number;
  by_delivery_status: {
    delivery_status: string;
    count: number;
  }[];
}

export interface FailedPaymentSummaryResult extends FailedPaymentSummary {
  access: AccessMetadata;
}

export interface RecentOrders {
  orders: OrderStatus[];
}

export interface RecentOrdersResult extends RecentOrders {
  access: AccessMetadata;
}

export interface FailedPaymentTrend {
  days: number;
  points: {
    date: string;
    total_count: number;
    failed_count: number;
  }[];
}

export interface FailedPaymentTrendResult extends FailedPaymentTrend {
  access: AccessMetadata;
}

export interface SensitivePaymentDenial {
  status: "denied";
  authentication: "successful";
  authorization: "denied";
  reason: string;
}

export interface DynamicDatabaseCredentials {
  username: string;
  password: string;
  leaseId: string;
  leaseDurationSeconds: number;
  accessTier?: "orders-full" | "orders-limited";
}

export interface VaultSession {
  clientToken: string;
  renewable: boolean;
  leaseDurationSeconds: number;
}
