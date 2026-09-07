# ADR 0001: Use Verify-issued JWT instead of SPIFFE

Status: accepted

## Decision

Use AWS KMS `private_key_jwt` to authenticate the ECS workload to IBM Verify, then use the Verify-issued JWT with Vault JWT auth.

## Rationale

The event demonstrates IBM Verify as the NHI authenticator and Vault as the authorization/credential broker. JWT is the direct protocol intersection. KMS keeps the private key non-exportable, Verify provides issuer/audience/claim semantics, and Vault consumes the same signed identity without another trust system.

SPIFFE would add SPIRE control-plane deployment, node/workload attestation, certificate rotation, and a bridge into Verify. That operational surface is not justified for a single ECS workload and would distract from the required Verify flow.

## Consequence

The JWT assertion and access token must have short lifetimes and replay controls. If the system grows into a multi-cluster workload mesh, revisit SPIFFE for workload-to-workload mTLS while retaining Verify at the enterprise identity boundary.
