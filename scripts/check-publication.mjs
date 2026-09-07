import { execFileSync } from "node:child_process";
import console from "node:console";
import process from "node:process";
import { readFileSync, existsSync, lstatSync } from "node:fs";

// Scan the staged file list and the current contents, without printing values.
const files = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const rules = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  [
    "github-token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  ],
  ["jwt", /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/],
  ["personal-macos-path", /\/Users\/[^\s/]+\//],
  ["personal-windows-path", /[A-Z]:\\Users\\[^\s\\]+\\/i],
  ["personal-cloud-folder", /OneDrive(?:-IBM)|CloudStorage\/(?:OneDrive)/],
];
const forbidden =
  /(?:^|\/)(?:\.terraform|output|node_modules|vendor|\.playwright-cli)(?:\/|$)|\.(?:tfstate|tfplan|pem|key|hclic|rtf|har|log)(?:\.|$)|(?:^|\/)deployment\.env$|\.tfvars(?:\.json)?$/;
const failures = [];
for (const file of files) {
  if (forbidden.test(file)) failures.push([file, "forbidden-file"]);
  if (!existsSync(file)) continue;
  if (lstatSync(file).isSymbolicLink()) {
    failures.push([file, "symlink"]);
    continue;
  }
  const contents = readFileSync(file);
  if (contents.includes(0)) continue;
  const text = contents.toString("utf8");
  for (const [name, pattern] of rules) {
    if (pattern.test(text)) failures.push([file, name]);
  }
}
for (const [file, rule] of failures) console.error(`${file}: ${rule}`);
if (failures.length > 0 || files.length === 0) {
  console.error(
    "Publication check failed. Inspect locally; never paste secret values.",
  );
  process.exit(1);
}
console.log(
  `Publication check passed for ${files.length} tracked files. Manual review is still required.`,
);
