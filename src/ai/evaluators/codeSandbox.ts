import { spawn } from 'child_process';
import { env } from '../../config/env.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('CodeSandbox');

export interface SandboxExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  memoryExceeded: boolean;
  timedOut: boolean;
  exitCode: number | null;
}

export class CodeSandbox {
  private timeoutMs: number;
  private maxMemoryMb: number;

  constructor(timeoutMs: number = env.SANDBOX_TIMEOUT_MS, maxMemoryMb: number = env.MAX_CODE_MEMORY_MB) {
    this.timeoutMs = timeoutMs;
    this.maxMemoryMb = maxMemoryMb;
  }

  public async executeJavaScript(code: string): Promise<SandboxExecutionResult> {
    const startTime = Date.now();

    // Check for obvious hostile patterns
    if (code.includes('require("child_process")') || code.includes('process.exit') || code.includes('fs.') || code.includes('http.') || code.includes('net.')) {
      return {
        success: false,
        stdout: '',
        stderr: 'Security Policy Violation: Network, filesystem, or process manipulation modules are forbidden.',
        executionTimeMs: 0,
        memoryExceeded: false,
        timedOut: false,
        exitCode: 1,
      };
    }

    return new Promise((resolve) => {
      // Execute node with restricted memory and sanitized environment
      const args = [`--max-old-space-size=${this.maxMemoryMb}`, '-e', code];
      const child = spawn('node', args, {
        env: { NODE_ENV: 'sandbox' }, // Clean environment, zero secrets
        timeout: this.timeoutMs,
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, this.timeoutMs);

      child.stdout.on('data', (data) => {
        if (stdout.length < 10000) stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        if (stderr.length < 10000) stderr += data.toString();
      });

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        const executionTimeMs = Date.now() - startTime;

        resolve({
          success: code === 0 && !timedOut,
          stdout: stdout.trim(),
          stderr: timedOut ? 'Execution timed out (infinite loop or CPU limit exceeded)' : stderr.trim(),
          executionTimeMs,
          memoryExceeded: stderr.includes('JavaScript heap out of memory') || signal === 'SIGKILL',
          timedOut,
          exitCode: code,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          stdout: '',
          stderr: err.message,
          executionTimeMs: Date.now() - startTime,
          memoryExceeded: false,
          timedOut: false,
          exitCode: 1,
        });
      });
    });
  }
}

export const codeSandbox = new CodeSandbox();
