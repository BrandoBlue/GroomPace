#!/usr/bin/env node
// Prints a compact "where the project stands" digest.
//
// Run automatically at the start of every Claude Code session (SessionStart
// hook in .claude/settings.json) so a fresh session knows the current state
// without anyone re-explaining it. Also fine to run by hand: `npm run status`.
//
// Everything here is derived from git and the source files, so it cannot go
// stale the way hand-written notes do. Keep it fast and offline — no network.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd) => { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };
const read = (f) => { try { return readFileSync(join(ROOT, f), 'utf8'); } catch { return ''; } };
const grab = (text, re) => (text.match(re) || [])[1] || '?';

const appVersion = grab(read('app.js'), /APP_VERSION\s*=\s*'([^']+)'/);
const cacheName  = grab(read('sw.js'),  /CACHE_NAME\s*=\s*'groompace-v([^']+)'/);
const schema     = grab(read('app.js'), /SCHEMA_VERSION\s*=\s*(\d+)/);

const branch  = sh('git rev-parse --abbrev-ref HEAD');
const dirty   = sh('git status --porcelain');
const commits = sh('git log -5 --format="%h %s"');
const tags    = sh('git for-each-ref --sort=-creatordate --format="%(refname:short)" --count=5 refs/tags');
const unmerged = sh('git log origin/main..HEAD --oneline');

// Two most recent entries from the session log. Everything above the first
// '---' is the how-to-write-an-entry preamble, so start after it.
const log = read('docs/SESSION-LOG.md');
const body = log.split(/\n---\n/).slice(1).join('\n---\n');
const entries = body.split(/^## /m).slice(1, 3).map(e => '## ' + e.trim()).join('\n\n');

const out = [];
out.push('=== GroomPace status ===');
out.push(`Version: v${appVersion}   ServiceWorker cache: v${cacheName}   Schema: v${schema}`);
if (appVersion !== cacheName) {
    out.push('!! APP_VERSION and CACHE_NAME disagree — they must match before release (invariant #5).');
}
out.push(`Branch: ${branch}${dirty ? '  (UNCOMMITTED CHANGES)' : '  (clean)'}`);
if (dirty) out.push(dirty.split('\n').map(l => '   ' + l).join('\n'));
if (unmerged) {
    out.push('\nOn this branch, not yet on main (= not yet in production):');
    out.push(unmerged.split('\n').map(l => '   ' + l).join('\n'));
}
out.push('\nRecent tags: ' + (tags.split('\n').join(', ') || 'none'));
out.push('\nRecent commits:');
out.push(commits.split('\n').map(l => '   ' + l).join('\n'));
if (entries) {
    out.push('\n=== Latest session-log entries (docs/SESSION-LOG.md) ===');
    out.push(entries);
}
out.push('\nRead claude.md for the project map. Production auto-deploys from main.');

const text = out.join('\n');

// --hook: emit the documented SessionStart envelope so the digest is injected
// into the model's context. Without the flag, print plainly for humans.
if (process.argv.includes('--hook')) {
    process.stdout.write(JSON.stringify({
        suppressOutput: true,
        hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text }
    }));
} else {
    console.log(text);
}
