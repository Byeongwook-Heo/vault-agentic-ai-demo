# Installation guide (English)

[한국어](SETUP.ko.md) · [README](../README.en.md)

Use an isolated AWS lab environment. Passing source tests does not establish deployment success. Verify connectivity, authentication, and authorization in the target environment after deployment.

## Prerequisites

- AWS CLI v2, Bash, jq, Git, zip, curl and the Session Manager plugin
- AWS SSO/profile, environment credentials or an IAM role
- Existing VPC with DNS enabled: two public ALB subnets, two private app subnets with NAT/API egress, and two private DB subnets
- Public Route 53 zone; an encrypted/versioned S3 bucket for Terraform state
- Approved Ubuntu 22.04 x86_64 AMI and owner ID. The current [AMI filter](../infra/terraform/data.tf) expects `hc-base-*` or `hc-security-base-*`; review that filter and bootstrap compatibility for other images.
- Valid Vault Enterprise license, Verify administrator access and two test users
- Approved inference-model license. The example provisions a private CPU runtime.
- Reviewed provisioning permissions for CloudFormation, IAM, CodeBuild, EC2, ECS, RDS, KMS, SSM and DNS. The installer role is broad and is not a production least-privilege template.

The default resource prefix is `bob-vault-nhi-demo`, independent of this repository's name. Avoid an environment with conflicting existing resources. Region defaults to `ap-northeast-2`; changing it also requires compatible AMIs, DB versions and console links.

## Private deployment inputs

```bash
git clone https://github.com/Byeongwook-Heo/vault-agentic-ai-demo.git
cd vault-agentic-ai-demo
export AWS_PROFILE='demo-operator'
export AWS_REGION='ap-northeast-2'
aws sso login --profile "$AWS_PROFILE"  # only for an SSO profile
aws sts get-caller-identity

export AWS_ACCOUNT_ID='<target-account-id>'
export VPC_ID='<vpc-id>'
export APP_SUBNET_IDS='<private-app-subnet-a>,<private-app-subnet-b>'
export TF_STATE_BUCKET='<existing-state-bucket>'
export VAULT_LICENSE_FILE='<license-file-location>'
export BOB_SOURCE_CIDRS='<operator-public-ipv4>/32'
cp infra/terraform/deployment.tfvars.json.example deployment.tfvars.json
export DEPLOYMENT_VARS_FILE='deployment.tfvars.json'
```

Replace every example value in the JSON. Match its VPC/subnets to the environment above. Specify an exact event operator IAM role and consistent future UTC expiry values. Keep `event_ssh_users={}` if SSH is not needed. Use your Verify region's official JWKS-fetching egress /32 addresses.

The private JSON is ignored by Git and stored as a project-scoped SSM SecureString. Do not commit credentials, license data or personal paths.

## Build plane and base infrastructure

These commands create billable resources. Review the plan before apply.

```bash
make aws-preflight
make bootstrap-aws
make configure-deployment
make upload-source
make ci
make tf-plan
make tf-apply-base
make vault-init
make db-bootstrap
make build-image
make deploy-mcp-bootstrap
```

Source uploads include only committed `HEAD` files. Review and commit local source changes first. Private Terraform inputs are fetched from SSM by CodeBuild, not bundled in the source ZIP. Vault binaries are downloaded from official releases or an approved artifact cache, never included in Git.

## Verify and access tiers

Create two separate Verify registrations:

1. User OIDC app: Authorization Code, PKCE S256, JWT Access Token, callback `https://<your-host>/auth/callback`, scopes `openid profile vault.db.read`.
2. Agent STS client: RFC 8693 Token Exchange; access-token subject/requested types; `private_key_jwt` authentication; public JWKS at `https://<your-host>/.well-known/jwks.json`.
3. Sign `access_tier=orders-full` for one user and `orders-limited` for another, in both user JWT and exchanged OBO JWT. Preserve the user subject and Agent client claim.
4. Set these environment variables from your tenant's actual metadata:
   - `VERIFY_USER_AUTHORIZATION_URL`, `VERIFY_USER_TOKEN_URL`, `VERIFY_USER_JWKS_URL`, `VERIFY_USER_ISSUER`, `VERIFY_USER_AUDIENCE`, `VERIFY_USER_CLIENT_ID`, `VERIFY_USER_SCOPES`
   - `VERIFY_OBO_TOKEN_URL`, `VERIFY_OBO_JWKS_URL`, `VERIFY_OBO_ISSUER`, `VERIFY_OBO_AUDIENCE`, `VERIFY_OBO_CLIENT_ID`, `VERIFY_OBO_SCOPE`, `VERIFY_OBO_ACTOR_CLAIM`, `VERIFY_OBO_ACTOR_VALUE`
   - Actor claim is normally `client_id`; actor value is the STS client ID. Scope is `vault.db.read`. Confirm actual issuer/audience values instead of guessing aliases. Never paste live JWTs into GitHub.
5. Store metadata and deploy:

```bash
make configure-chatbot-verify
make bootstrap-chat-session-secret
make bootstrap-contextforge-secret
make bootstrap-agent-runtime-secret
make vault-bootstrap
make chatbot-plan
# Review plan, then:
make deploy-chatbot
```

The UI's `stageDestinations` in [app.js](../apps/mcp-server/public/app.js) contains example operator URLs. Configure deployment-specific links only in your private deployment copy; do not push real tenant values to the shared repository. The Vault link is HTTPS localhost and requires an operator SSM tunnel.

## Validate and shut down

```bash
export DEMO_URL='https://<your-host>'
make smoke
make access-tier-smoke
make demo-access-report
make demo-status
```

The role report is not a real user-login test. Separately log in with the full and limited accounts, query ORD-1001/ORD-1002/recent orders/statistics, and check logout/account switching. General conversation should work without protected-data access.

`make agent-runtime-stop` stops only the inference EC2 instance. RDS, ECS, ALB, NAT, storage and logs may continue to cost money. `make destroy` requires explicit confirmation and can delete data. Review backups, retained resources and the separate bootstrap stack first.
