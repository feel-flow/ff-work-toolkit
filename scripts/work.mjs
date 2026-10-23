#!/usr/bin/env node
// Thin capability boundary; configuration/generation/recording stay in the shared ASDD runtime.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

try {
  if (fs.lstatSync(process.argv[1]).isSymbolicLink()) throw new Error('Do not launch through a symlink');
  const root = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
  if (manifest.name !== 'ff-work-toolkit') throw new Error('Unexpected plugin identity');
  for (const key of ['FF_WORK_TOOLKIT_ROOT', 'CLAUDE_PLUGIN_ROOT', 'GROK_PLUGIN_ROOT']) {
    if (process.env[key] && fs.realpathSync(process.env[key]) !== root) throw new Error(`${key}: plugin root mismatch; re-open the installed skill`);
  }
  const [mode, ...args] = process.argv.slice(2);
  if (!['init', 'work'].includes(mode)) throw new Error('Use init or work');
  let project = process.cwd(), input;
  const valueOptions = mode === 'init' ? ['--root', '--config', '--adopt'] : ['--root', '--record', '--status'];
  const flags = mode === 'init' ? ['--apply', '--check'] : ['--apply'];
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`);
    seen.add(arg);
    if (valueOptions.includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--root') project = value;
      if (arg === '--config') input = value;
    } else if (!flags.includes(arg)) throw new Error(`Unknown argument: ${arg}`);
  }
  const runtime = path.join(root, 'scripts/asdd');
  // Reject indirect runtime paths before dynamic import or child execution.
  for (const relative of ['scripts', 'scripts/asdd', 'scripts/asdd/config.mjs', 'scripts/asdd/generate.mjs', 'scripts/asdd/cli.mjs', 'scripts/asdd/work.mjs']) {
    const target = path.join(root, relative), stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || fs.realpathSync(target) !== target || (relative.endsWith('.mjs') ? !stat.isFile() : !stat.isDirectory())) throw new Error(`Runtime is not a regular resource under this plugin: ${relative}`);
  }
  // No fallback to another installed plugin or a developer checkout.
  const { loadConfig, validateConfig, ORPHAN_STATE_CODE } = await import(new URL('./asdd/config.mjs', import.meta.url));
  let current;
  try { current = loadConfig(fs.realpathSync(project)); }
  catch (error) {
    // Re-applying agreed settings is the documented recovery from a deleted config, and
    // the generator reads its own state rather than loadConfig. Everything else stops.
    if (mode !== 'init' || !input || error.code !== ORPHAN_STATE_CODE) throw error;
    // Judge unsupported features against the last applied settings, so a deleted config
    // cannot be the way to drop them silently.
    current = error.recorded;
    process.stderr.write('ff-work-toolkit: .asdd/config.json is missing while generation state remains; proceeding with the agreed settings to restore it\n');
  }
  const proposed = input ? validateConfig(JSON.parse(fs.readFileSync(input, 'utf8'))) : null;
  for (const config of [current, proposed]) {
    if (!config) continue;
    const enabled = Object.entries(config.features).filter(([, value]) => value).map(([name]) => name);
    if (enabled.length) throw new Error(`ff-work-toolkit does not provide ${enabled.join(', ')}. Keep existing settings and use ff-dev-toolkit; nothing was changed.`);
  }
  const result = spawnSync(process.execPath, [path.join(runtime, mode === 'init' ? 'cli.mjs' : 'work.mjs'), ...args], {
    stdio: ['inherit', 'inherit', 'pipe'], encoding: 'utf8', env: { ...process.env, FF_DEV_TOOLKIT_ROOT: root },
  });
  if (result.stderr) process.stderr.write(result.stderr.replace(/ff-dev-toolkit(?=更新| \d)/g, 'ff-work-toolkit'));
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Shared runtime stopped by signal ${result.signal}`);
  process.exitCode = result.status ?? 1;
} catch (error) {
  process.stderr.write(`ff-work-toolkit: ${error.message}\n`);
  process.exitCode = 1;
}
