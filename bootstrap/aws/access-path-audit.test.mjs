import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const auditScript = fileURLToPath(
  new URL("../../scripts/access-path-audit.sh", import.meta.url),
);

// A local AWS CLI fixture only: these tests never read credentials or contact AWS.
const fakeAws = `#!/usr/bin/env node
const args = process.argv.slice(2).join(' ');
const mode = process.env.AUDIT_TEST_MODE;
function deny() { process.stderr.write('AccessDenied: test fixture\\n'); process.exit(254); }
function out(value) { console.log(typeof value === 'string' ? value : JSON.stringify(value)); }
if (args.startsWith('sts get-caller-identity')) {
  out('123456789012');
} else if (args.startsWith('ssm get-parameter')) {
  if (mode === 'endpoint-denied') deny();
  out('https://vault.bob-vault-nhi-demo.internal:8200');
} else if (args.startsWith('codebuild batch-get-projects')) {
  out({vpcConfig:{vpcId:'vpc-test',subnets:['subnet-test'],securityGroupIds:['sg-build']}});
} else if (args.startsWith('ec2 describe-instances')) {
  if (args.includes('PrivateIpAddress')) out('10.0.1.20');
  else if (args.includes('VpcId')) out('vpc-test');
  else if (args.includes('SecurityGroups')) out('sg-vault');
  else out('i-test');
} else if (args.startsWith('route53 list-hosted-zones-by-vpc')) {
  out({HostedZoneSummaries:[{Name:'bob-vault-nhi-demo.internal.',HostedZoneId:'ZTEST'}]});
} else if (args.startsWith('route53 list-resource-record-sets')) {
  if (mode === 'dns-denied') deny();
  out({ResourceRecordSets:[{Name:'vault.bob-vault-nhi-demo.internal.',Type:'A',ResourceRecords:[{Value:'10.0.1.20'}]}]});
} else if (args.startsWith('ec2 describe-security-groups')) {
  const egress = ['tcp','udp'].map(p=>({IpProtocol:p,FromPort:53,ToPort:53,IpRanges:[{CidrIp:'10.0.0.0/8'}]}));
  if (mode !== 'egress-denied') egress.push({IpProtocol:'tcp',FromPort:8200,ToPort:8200,IpRanges:[{CidrIp:'10.0.0.0/8'}]});
  out({SecurityGroups:[{IpPermissions:[{IpProtocol:'tcp',FromPort:8200,ToPort:8200,UserIdGroupPairs:[{GroupId:'sg-build'}]}],IpPermissionsEgress:egress}]});
} else { process.stderr.write('Unexpected AWS action: '+args+'\\n'); process.exit(99); }
`;

function runAudit(mode) {
  const dir = mkdtempSync(join(tmpdir(), "bob-audit-test-"));
  try {
    writeFileSync(join(dir, "aws"), fakeAws, { mode: 0o700 });
    writeFileSync(
      join(dir, "make"),
      "#!/bin/sh\necho UNEXPECTED_MAKE_EXECUTION >&2\nexit 99\n",
      { mode: 0o700 },
    );
    const result = spawnSync("bash", [auditScript], {
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        AWS_ACCESS_KEY_ID: "test-only",
        AWS_SECRET_ACCESS_KEY: "test-only",
        AWS_SESSION_TOKEN: "test-only",
        PROJECT_NAME: "bob-vault-nhi-demo",
        AUDIT_TEST_MODE: mode,
      },
    });
    assert.ifError(result.error);
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("access audit reports PASS only when all metadata checks complete", () => {
  const result = runAudit("pass");
  assert.equal(result.status, 0);
  assert.match(result.output, /Result: PASS/);
});

test("access audit continues SG checks after DNS read permission is denied", () => {
  const result = runAudit("dns-denied");
  assert.equal(result.status, 2);
  assert.match(result.output, /Result: INCOMPLETE/);
  assert.match(result.output, /allows DNS egress/);
  assert.doesNotMatch(result.output, /Result: PASS/);
});

test("access audit distinguishes an unreadable endpoint from a network failure", () => {
  const result = runAudit("endpoint-denied");
  assert.equal(result.status, 2);
  assert.match(result.output, /Result: INCOMPLETE/);
});

test("access audit fails closed on missing Vault egress without running its advice", () => {
  const result = runAudit("egress-denied");
  assert.equal(result.status, 1);
  assert.match(result.output, /expected Vault egress path/);
  assert.doesNotMatch(result.output, /UNEXPECTED_MAKE_EXECUTION|Result: PASS/);
});
