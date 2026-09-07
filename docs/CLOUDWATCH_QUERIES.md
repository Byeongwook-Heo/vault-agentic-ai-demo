# CloudWatch Logs Insights

Log group: `/aws/ecs/bob-vault-nhi-demo`

Recent errors:

```text
fields @timestamp, requestId, err.type, err.message
| filter level >= 50
| sort @timestamp desc
| limit 50
```

Tool latency:

```text
fields @timestamp, requestId, action, latencyMs
| filter ispresent(latencyMs)
| stats count() as calls, pct(latencyMs, 50) as p50, pct(latencyMs, 95) as p95 by action
```

Do not query or export authorization headers, JWTs, Vault tokens, database usernames, or passwords. Those fields are prohibited and redacted by the application.
