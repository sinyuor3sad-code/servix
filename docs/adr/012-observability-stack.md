# ADR-012: Observability Stack

## التاريخ
2026-02-15

## الحالة
مقبول

## السياق
نحتاج مراقبة شاملة تغطي: metrics، tracing، logging، alerting.

## القرار
**OpenTelemetry + Prometheus + Grafana + Jaeger + Winston.**

## البنية

```
Application
  ├── Winston (structured JSON logs) → Loki
  ├── OpenTelemetry SDK (traces) → Jaeger
  └── Prometheus client (metrics) → Prometheus → Grafana

Grafana: لوحات موحدة + تنبيهات
Uptime Kuma: مراقبة خارجية
```

## المكونات

| المكون | الدور | البديل المدروس |
|--------|-------|----------------|
| **Prometheus** | Metrics collection | Datadog ($$$) |
| **Grafana** | Visualization + alerts | Kibana (أثقل) |
| **Jaeger** | Distributed tracing | Zipkin (أقل ميزات) |
| **Winston** | Structured logging | Pino (أسرع لكن أقل ميزات) |
| **OpenTelemetry** | Instrumentation | proprietary SDKs |
| **Uptime Kuma** | External monitoring | Pingdom ($$$) |

## المقاييس المراقبة
- SLOs: availability 99.9%، latency p95 < 500ms
- Business: إيرادات، حجوزات، اشتراكات
- Infrastructure: CPU، memory، disk، connections
- Error budgets: alerting عند تجاوز budget
