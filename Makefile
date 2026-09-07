SHELL := /bin/bash
AWS_REGION ?= ap-northeast-2
AWS_ACCOUNT_ID ?=
PROJECT ?= bob-vault-nhi-demo
ARTIFACT_BUCKET ?= $(PROJECT)-artifacts-$(AWS_ACCOUNT_ID)-$(AWS_REGION)
SOURCE_KEY ?= source/$(PROJECT).zip
SOURCE_ARCHIVE ?= /tmp/$(PROJECT)-source.zip
VPC_ID ?=
APP_SUBNET_IDS ?=
TF_STATE_BUCKET ?=
ACCESS_TIER_ENFORCEMENT ?= enforce
VERIFY_ACCESS_TIER_CLAIM ?= access_tier
VERIFY_ACCESS_TIER_FULL_VALUE ?= orders-full
VERIFY_ACCESS_TIER_LIMITED_VALUE ?= orders-limited
VAULT_VERSION ?= 2.1.0+ent

.PHONY: help install format lint typecheck test test-unit test-integration
.PHONY: local-up local-down local-smoke aws-preflight bootstrap-aws upload-source ci
.PHONY: tf-init tf-validate tf-plan tf-apply-base bootstrap-mcp-token
.PHONY: build-image push-image deploy-mcp-bootstrap verify-preflight
.PHONY: verify-client-jwt-plan verify-client-enable-jwt
.PHONY: vault-port-forward vault-init vault-bootstrap db-bootstrap deploy-app
.PHONY: configure-verify configure-chatbot-verify bootstrap-chat-session-secret bootstrap-contextforge-secret
.PHONY: bootstrap-agent-runtime-secret agent-runtime-start agent-runtime-stop
.PHONY: chatbot-plan deploy-chatbot copy-bob-token smoke access-tier-smoke demo-access-report demo-reset demo-status security-check
.PHONY: event-access-plan event-access-apply event-access-connect destroy
.PHONY: source-cidr-add event-ssh-plan event-ssh-apply
.PHONY: verify-jwks-plan verify-jwks-apply
.PHONY: access-path-audit

help:
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "%-28s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

configure-deployment: ## Upload private Terraform inputs to encrypted Parameter Store.
	@./scripts/configure-deployment.sh

install: ## No-op: dependencies are installed in CodeBuild.
	@echo "Local installation is intentionally disabled; run 'make ci'."

format lint typecheck test test-unit test-integration security-check: ## Run validation in AWS CodeBuild.
	@./scripts/start-codebuild.sh "$(PROJECT)-ci" "CI_TARGET=$@"

tf-init tf-validate: ## Initialize and validate Terraform in AWS CodeBuild.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=validate,VAULT_VERSION=$(VAULT_VERSION)"

local-up local-down local-smoke: ## Run the local-mode suite inside AWS CodeBuild.
	@./scripts/start-codebuild.sh "$(PROJECT)-ci" "CI_TARGET=$@"

aws-preflight: ## Validate AWS identity, network, AMI, license parameter, and required tools.
	@./scripts/aws-preflight.sh

bootstrap-aws: ## Create AWS-only build, artifact, and ECR bootstrap resources.
	@./scripts/aws-preflight.sh
	@PROJECT_NAME="$(PROJECT)" AWS_ACCOUNT_ID="$(AWS_ACCOUNT_ID)" AWS_REGION="$(AWS_REGION)" ARTIFACT_BUCKET="$(ARTIFACT_BUCKET)" VPC_ID="$(VPC_ID)" APP_SUBNET_IDS="$(APP_SUBNET_IDS)" TF_STATE_BUCKET="$(TF_STATE_BUCKET)" ./scripts/deploy-build-stack.sh
	@./scripts/upload-license.sh
	@./scripts/configure-source-cidr.sh
	@./bootstrap/aws/bootstrap-mcp-token.sh
	@./bootstrap/aws/bootstrap-contextforge-secret.sh

upload-source: ## Upload a source-only archive to the versioned S3 artifact bucket.
	@./scripts/upload-source.sh "$(ARTIFACT_BUCKET)" "$(SOURCE_KEY)" "$(SOURCE_ARCHIVE)"

ci: ## Run all validation in AWS CodeBuild.
	@./scripts/start-codebuild.sh "$(PROJECT)-ci" "CI_TARGET=ci"

tf-plan: ## Run Terraform plan in AWS CodeBuild.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=plan,VAULT_VERSION=$(VAULT_VERSION)"

tf-apply-base: ## Apply base infrastructure without the MCP ECS service.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=apply-base,VAULT_VERSION=$(VAULT_VERSION)"

bootstrap-mcp-token: ## Generate and store the transport token without printing it.
	@./bootstrap/aws/bootstrap-mcp-token.sh

build-image push-image: ## Build in CodeBuild and push an immutable image to ECR.
	@./scripts/start-codebuild.sh "$(PROJECT)-image" "IMAGE_ACTION=build-and-push"

deploy-mcp-bootstrap: ## Deploy MCP health/JWKS/dashboard before Verify configuration.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=deploy-bootstrap,VAULT_VERSION=$(VAULT_VERSION)"

verify-preflight: ## Validate the real Verify client assertion and issued JWT without printing tokens.
	@./scripts/start-codebuild.sh "$(PROJECT)-bootstrap" "BOOTSTRAP_ACTION=verify-preflight"

verify-client-jwt-plan: ## Inspect the Verify API client and show the sanitized JWT conversion plan.
	@test -n "$(VERIFY_MANAGER_CLIENT_ID)" || { echo "Set VERIFY_MANAGER_CLIENT_ID to a separate temporary Verify management client."; exit 2; }
	@PRINT_BUILD_LOGS=1 ./scripts/start-codebuild.sh "$(PROJECT)-bootstrap" "BOOTSTRAP_ACTION=verify-client-jwt-plan,VERIFY_MANAGER_CLIENT_ID=$(VERIFY_MANAGER_CLIENT_ID)"

verify-client-enable-jwt: ## Issue JWT access tokens and remove temporary Verify client admin access.
	@test -n "$(VERIFY_MANAGER_CLIENT_ID)" || { echo "Set VERIFY_MANAGER_CLIENT_ID to a separate temporary Verify management client."; exit 2; }
	@test "$(CONFIRM_VERIFY_CLIENT_UPDATE)" = "$(PROJECT)" || { echo "Set CONFIRM_VERIFY_CLIENT_UPDATE=$(PROJECT)"; exit 2; }
	@./scripts/start-codebuild.sh "$(PROJECT)-bootstrap" "BOOTSTRAP_ACTION=verify-client-enable-jwt,VERIFY_MANAGER_CLIENT_ID=$(VERIFY_MANAGER_CLIENT_ID),CONFIRM_VERIFY_CLIENT_UPDATE=$(CONFIRM_VERIFY_CLIENT_UPDATE)"

configure-verify: ## Store IBM Verify public integration values from VERIFY_* environment variables.
	@./scripts/configure-verify.sh

configure-chatbot-verify: ## Store Verify OIDC user-login and OBO STS public metadata.
	@./scripts/configure-chatbot-verify.sh

bootstrap-chat-session-secret: ## Create the encrypted chatbot session key without printing it.
	@./bootstrap/aws/bootstrap-chat-session-secret.sh

bootstrap-contextforge-secret: ## Create private ContextForge runtime secrets without printing them.
	@./bootstrap/aws/bootstrap-contextforge-secret.sh

bootstrap-agent-runtime-secret: ## Store the private planning runtime token without printing it.
	@./bootstrap/aws/bootstrap-agent-runtime-secret.sh

agent-runtime-start: ## Start the private planning EC2 runtime; model readiness is shown in the chatbot.
	@./scripts/agent-runtime-start.sh

agent-runtime-stop: ## Stop the private planning runtime after the event to control cost.
	@./scripts/agent-runtime-stop.sh

copy-bob-token: ## Copy the MCP transport token to the macOS clipboard without printing it.
	@./scripts/copy-bob-token.sh

vault-port-forward: ## Open a local SSM port forward to the private Vault listener.
	@./scripts/ssm-vault-port-forward.sh

vault-init: ## Initialize Vault in the private VPC and securely store recovery material.
	@./scripts/start-codebuild.sh "$(PROJECT)-bootstrap" "BOOTSTRAP_ACTION=vault-init"

db-bootstrap: ## Build the synthetic RDS schema and least-privilege database roles.
	@./scripts/start-codebuild.sh "$(PROJECT)-bootstrap" "BOOTSTRAP_ACTION=db-bootstrap"


vault-bootstrap: ## Configure namespace, audit, tiered JWT policies, and database secrets engine.
	@./scripts/start-codebuild.sh "$(PROJECT)-bootstrap" "BOOTSTRAP_ACTION=vault-bootstrap,ACCESS_TIER_ENFORCEMENT=$(ACCESS_TIER_ENFORCEMENT),VERIFY_ACCESS_TIER_CLAIM=$(VERIFY_ACCESS_TIER_CLAIM),VERIFY_ACCESS_TIER_FULL_VALUE=$(VERIFY_ACCESS_TIER_FULL_VALUE),VERIFY_ACCESS_TIER_LIMITED_VALUE=$(VERIFY_ACCESS_TIER_LIMITED_VALUE),SKIP_BOOTSTRAP_NODE_BUILD=true,VAULT_VERSION=$(VAULT_VERSION)"

deploy-app: ## Deploy the full MCP task using the ECR image digest.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=deploy-app"

chatbot-plan: ## Plan the full chatbot and private planning runtime integration.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=chatbot-plan,ACCESS_TIER_ENFORCEMENT=$(ACCESS_TIER_ENFORCEMENT),VERIFY_ACCESS_TIER_CLAIM=$(VERIFY_ACCESS_TIER_CLAIM),VERIFY_ACCESS_TIER_FULL_VALUE=$(VERIFY_ACCESS_TIER_FULL_VALUE),VERIFY_ACCESS_TIER_LIMITED_VALUE=$(VERIFY_ACCESS_TIER_LIMITED_VALUE),VAULT_VERSION=$(VAULT_VERSION)"

deploy-chatbot: ## Deploy the Verify-authenticated chatbot, OBO agent, and MCP service.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=deploy-chatbot,ACCESS_TIER_ENFORCEMENT=$(ACCESS_TIER_ENFORCEMENT),VERIFY_ACCESS_TIER_CLAIM=$(VERIFY_ACCESS_TIER_CLAIM),VERIFY_ACCESS_TIER_FULL_VALUE=$(VERIFY_ACCESS_TIER_FULL_VALUE),VERIFY_ACCESS_TIER_LIMITED_VALUE=$(VERIFY_ACCESS_TIER_LIMITED_VALUE),VAULT_VERSION=$(VAULT_VERSION)"

event-access-plan: ## Plan time-bounded, audited SSM access for event operators.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=event-access-plan"

event-access-apply: ## Apply time-bounded, audited SSM access without opening SSH.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=event-access-apply"

event-access-connect: ## Assume the event operator role and open the approved SSM shell.
	@./scripts/start-event-ssm-session.sh

source-cidr-add: ## Add one source CIDR without replacing existing approved networks.
	@test -n "$(SOURCE_CIDR)" || { echo "Set SOURCE_CIDR to an explicit IPv4 CIDR such as 203.0.113.10/32."; exit 2; }
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=source-cidr-add,SOURCE_CIDR=$(SOURCE_CIDR)"

event-ssh-plan: ## Plan the DEMO public-key path through the restricted bastion.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=event-ssh-plan"

event-ssh-apply: ## Deploy the DEMO public-key path through the restricted bastion.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=event-ssh-apply"

verify-jwks-plan: ## Plan path-restricted JWKS access from official IBM Verify Europe egress IPs.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=verify-jwks-plan"

verify-jwks-apply: ## Allow IBM Verify Europe to retrieve only the public JWKS.
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=verify-jwks-apply"

smoke: ## Run AWS endpoint and MCP allow/deny smoke tests.
	@./scripts/smoke.sh

access-tier-smoke: ## Verify Vault dynamic roles and PostgreSQL full/limited view isolation.
	@./scripts/start-codebuild.sh "$(PROJECT)-bootstrap" "BOOTSTRAP_ACTION=access-tier-smoke"

demo-access-report: ## Show a sanitized full/limited user access report from Vault and PostgreSQL.
	@PRINT_BUILD_REPORT=1 ./scripts/start-codebuild.sh "$(PROJECT)-bootstrap" "BOOTSTRAP_ACTION=demo-access-report"

demo-reset: ## Reset only sanitized in-memory demo events.
	@./scripts/demo-reset.sh

demo-status: ## Display endpoint health and sanitized deployment state.
	@./scripts/demo-status.sh

access-path-audit: ## Validate Vault/RDS access path from CodeBuild and network policy perspective.
	@./scripts/access-path-audit.sh

destroy: ## Destruction is disabled unless CONFIRM_DESTROY=bob-vault-nhi-demo.
	@test "$(CONFIRM_DESTROY)" = "$(PROJECT)" || { echo "Set CONFIRM_DESTROY=$(PROJECT)"; exit 2; }
	@./scripts/start-codebuild.sh "$(PROJECT)-terraform" "TF_ACTION=destroy,CONFIRM_DESTROY=$(PROJECT)"
