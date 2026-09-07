import type { AccessTier } from "./access-control.js";

export interface OrderQueries {
  orderStatus: string;
  failedPaymentSummary: string;
  recentOrders: string;
  failedPaymentTrend: string;
}

export function orderQueries(accessTier: AccessTier): OrderQueries {
  const view =
    accessTier === "orders-limited"
      ? "v_bob_order_status_limited"
      : "v_bob_order_status_full";
  return {
    orderStatus: `
      SELECT order_id, payment_status, delivery_status, updated_at
      FROM ${view}
      WHERE order_id = $1
      LIMIT 1
    `,
    failedPaymentSummary: `
      SELECT delivery_status, COUNT(*)::int AS count
      FROM ${view}
      WHERE payment_status = 'FAILED'
        AND updated_at >= $1::date
        AND updated_at < ($1::date + INTERVAL '1 day')
      GROUP BY delivery_status
      ORDER BY delivery_status
      LIMIT 20
    `,
    recentOrders: `
      SELECT order_id, payment_status, delivery_status, updated_at
      FROM ${view}
      ORDER BY updated_at DESC
      LIMIT $1
    `,
    failedPaymentTrend: `
      SELECT
        to_char(updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS total_count,
        COUNT(*) FILTER (WHERE payment_status = 'FAILED')::int AS failed_count
      FROM ${view}
      WHERE updated_at >= now() - ($1::int * INTERVAL '1 day')
      GROUP BY to_char(updated_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
      ORDER BY date
      LIMIT 7
    `,
  };
}
