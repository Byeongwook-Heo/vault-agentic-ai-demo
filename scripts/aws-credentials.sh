#!/usr/bin/env bash
# Standard AWS credential chain: SSO/profile, environment or IAM role.
# Sourcing this helper does not change interactive-shell options.
load_demo_aws_credentials() {
  export AWS_REGION="${AWS_REGION:-ap-northeast-2}"
  export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${AWS_REGION}}"
  if ! aws sts get-caller-identity --query Account --output text >/dev/null; then
    echo "AWS authentication failed. Refresh your SSO/profile or environment credentials." >&2
    return 1
  fi
}
