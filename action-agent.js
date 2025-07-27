#!/usr/bin/env node

/**
 * Action Agent - Lightweight secure shell executor
 * Triggered by mistral-cli.js when a Mistral response contains ACTION:<cmd>
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

// Light filtering: we only block truly dangerous commands.
const BLOCKED_KEYWORDS = [
  'rm', 'shutdown', 'reboot', 'halt', 'poweroff', 'mkfs', 'dd', 'chmod 777',
];

function isCommandAllowed(cmd) {
  const lower = cmd.toLowerCase();
  return !BLOCKED_KEYWORDS.some(keyword => lower.includes(keyword));
}

export async function runAction(command) {
  if (!isCommandAllowed(command)) {
    return chalk.red(`⛔ Command blocked for security reasons: ${command}`);
  }
  try {
    const { stdout, stderr } = await execAsync(command, { shell: '/bin/bash', encoding: 'utf8', maxBuffer: 1024 * 1024 });
    let output = '';
    if (stdout) output += stdout;
    if (stderr) output += `\n${chalk.yellow('STDERR:')}\n${stderr}`;
    if (!output.trim()) output = chalk.gray('<no output>');
    return output;
  } catch (error) {
    return chalk.red(`❌ Execution error: ${error.message}`);
  }
}
