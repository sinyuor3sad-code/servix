# Data Processing Agreement (DPA) — SERVIX

**Version:** 1.0 | **Effective Date:** April 2026

## 1. Parties

- **Data Controller:** The Salon (Tenant) using SERVIX
- **Data Processor:** SERVIX Platform (operated by [Company Name])

## 2. Scope

This DPA governs the processing of personal data by SERVIX on behalf of salon operators (tenants) who use the platform to manage their business operations.

## 3. Processed Data Categories

| Category | Data Subjects | Processing Purpose |
|----------|--------------|-------------------|
| Client contact info | Salon clients | Booking management |
| Appointment history | Salon clients | Service delivery |
| Employee records | Salon staff | Workforce management |
| Financial data | All | Invoicing, payments |
| Device tokens | Staff users | Push notifications |

## 4. Processing Instructions

SERVIX processes personal data only:
- To provide the contracted salon management services
- Based on the controller's (salon's) instructions
- In compliance with applicable Saudi laws (PDPL, ZATCA)

## 5. Security Measures

SERVIX implements the following technical and organizational measures:

### Technical
- TLS 1.3 for data in transit
- AES-256-GCM for data at rest
- Database encryption for sensitive fields
- Network segmentation (Kubernetes NetworkPolicies)
- Automated vulnerability scanning (CI/CD)

### Organizational
- Role-based access control (RBAC)
- Audit logging of all data access
- Incident response procedures
- Regular security assessments
- Employee security training

## 6. Sub-processors

| Sub-processor | Purpose | Location |
|--------------|---------|----------|
| Hetzner Cloud | Infrastructure hosting | Germany |
| CloudFlare | CDN, DNS, DDoS protection | Global |
| Moyasar | Payment processing | Saudi Arabia |
| Google Firebase | Push notifications | Global |

Changes to sub-processors will be notified 30 days in advance.

## 7. Data Breach Notification

SERVIX will notify the data controller within **72 hours** of discovering a personal data breach. Notification includes:
- Nature of the breach
- Categories and approximate number of affected data subjects
- Likely consequences
- Measures taken to address the breach

## 8. Data Subject Rights

SERVIX provides technical means for controllers to fulfill data subject requests:
- Data export API endpoint
- Data correction API endpoint
- Account deletion with 30-day cooling period
- Audit trail of all data processing activities

## 9. Return and Deletion

Upon termination of services:
- Controller can export all data via API within 30 days
- After 30 days, data is securely deleted
- Exception: Data required by law (tax records) is retained per legal requirements
