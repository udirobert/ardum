import { execSync } from "child_process";

const SECRET_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /api[_-]?key\s*[:=]\s*["']?[^"'\s]{16,}/i, description: "API Key" },
  { pattern: /secret\s*[:=]\s*["']?[^"'\s]{16,}/i, description: "Secret" },
  { pattern: /password\s*[:=]\s*["']?[^"'\s]{8,}/i, description: "Password" },
  { pattern: /token\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}/i, description: "Token" },
  { pattern: /sk-[A-Za-z0-9_-]{20,}/, description: "OpenAI API Key (sk-)" },
  { pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, description: "Private Key" },
  { pattern: /ghp_[A-Za-z0-9_]{36,}/, description: "GitHub Personal Access Token" },
  { pattern: /gho_[A-Za-z0-9_]{36,}/, description: "GitHub OAuth Token" },
  { pattern: /xox[baprs]-[A-Za-z0-9_-]{10,}/, description: "Slack Token" },
  { pattern: /AKIA[0-9A-Z]{16}/, description: "AWS Access Key" },
  { pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, description: "JWT Token" },
  { pattern: /SUPABASE_[A-Za-z0-9_-]{20,}/, description: "Supabase Key" },
  { pattern: /postgres(?:ql)?:\/\/[^@\s]+:[^@\s]+@/, description: "Database URL with credentials" },
  { pattern: /mongodb(?:\+srv)?:\/\/[^@\s]+:[^@\s]+@/, description: "MongoDB URL with credentials" },
];

type Match = { file: string; line: number; content: string; description: string };

const stagedFiles = execSync("git diff --cached --name-only --diff-filter=ACMR", {
  encoding: "utf-8",
})
  .trim()
  .split("\n")
  .filter(Boolean);

if (stagedFiles.length === 0) {
  process.exit(0);
}

const matches: Match[] = [];

for (const file of stagedFiles) {
  try {
    const diff = execSync(`git diff --cached -U1000000 -- "${file}"`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });

    const lines = diff.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line.startsWith("+")) continue;

      const content = line.slice(1);
      if (content.trim().length === 0) continue;

      // Skip lines that read from process.env — these are env var
      // references, not hardcoded secrets.
      if (/process\.env\./.test(content)) continue;

      for (const { pattern, description } of SECRET_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(content)) {
          matches.push({ file, line: i + 1, content: content.trim(), description });
        }
      }
    }
  } catch {
    // skip files that can't be diffed (binary, etc.)
  }
}

if (matches.length > 0) {
  console.error("\n\x1b[31m[!] Potential secrets detected in staged files:\x1b[0m\n");
  for (const match of matches) {
    console.error(`  \x1b[33m${match.file}:${match.line}\x1b[0m`);
    console.error(`    Type: ${match.description}`);
    console.error(`    Content: ${match.content.slice(0, 100)}`);
    console.error();
  }
  console.error("\x1b[31mCommit blocked. Remove or replace secrets before committing.\x1b[0m\n");
  console.error("To bypass (not recommended): git commit --no-verify\n");
  process.exit(1);
}
