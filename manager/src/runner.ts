/**
 * Runner — Bun.spawn wrappers for executing Flint CLI commands.
 *
 * Two modes:
 *   runCommand()    — run a command to completion, capture output as a string
 *   spawnAsStream() — run a command, stream stdout+stderr as a ReadableStream
 *                     of SSE-formatted strings (for build log panels)
 */

export interface RunResult {
  ok: boolean;
  output: string;
  exitCode: number;
}

/**
 * Run a command in `cwd` and wait for it to finish.
 * Returns stdout+stderr combined, and the exit code.
 */
export async function runCommand(
  cmd: string[],
  cwd: string,
  env?: Record<string, string>,
): Promise<RunResult> {
  const proc = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  const output = [stdout, stderr].filter(Boolean).join('\n');
  return { ok: exitCode === 0, output, exitCode };
}

/**
 * Spawn a command and return a ReadableStream that emits Server-Sent Events.
 *
 * Each stdout/stderr line is emitted as:
 *   data: <escaped line>\n\n
 *
 * When the process exits:
 *   event: done\ndata: <exit code>\n\n
 *
 * The caller should pipe this stream directly into a Response with
 *   Content-Type: text/event-stream
 */
/**
 * Run multiple commands sequentially, streaming all output as SSE.
 * Emits `event: section` before each step label.
 * Stops and emits `event: done` with the non-zero exit code on first failure.
 */
export function spawnChained(
  steps: Array<{ label: string; cmd: string[]; env?: Record<string, string> }>,
  cwd: string,
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      for (const step of steps) {
        controller.enqueue(`event: section\ndata: ${escapeHtml(step.label)}\n\n`);

        const proc = Bun.spawn(step.cmd, {
          cwd,
          env: { ...process.env, ...step.env },
          stdout: 'pipe',
          stderr: 'pipe',
        });

        async function pipe(stream: ReadableStream<Uint8Array>, prefix = ''): Promise<void> {
          const reader = stream.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const line of lines) {
              controller.enqueue(`data: ${escapeHtml(prefix + line)}\n\n`);
            }
          }
          if (buf) controller.enqueue(`data: ${escapeHtml(prefix + buf)}\n\n`);
        }

        await Promise.all([
          pipe(proc.stdout as ReadableStream<Uint8Array>),
          pipe(proc.stderr as ReadableStream<Uint8Array>, '[err] '),
        ]);

        const code = await proc.exited;
        if (code !== 0) {
          controller.enqueue(`event: done\ndata: ${code}\n\n`);
          controller.close();
          return;
        }
      }
      controller.enqueue(`event: done\ndata: 0\n\n`);
      controller.close();
    },
  });
}

export function spawnAsStream(
  cmd: string[],
  cwd: string,
  env?: Record<string, string>,
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      const proc = Bun.spawn(cmd, {
        cwd,
        env: { ...process.env, ...env },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      // Stream stdout
      async function pipeOutput(stream: ReadableStream<Uint8Array>, prefix = ''): Promise<void> {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const escaped = escapeHtml(prefix + line);
            controller.enqueue(`data: ${escaped}\n\n`);
          }
        }
        if (buffer) {
          controller.enqueue(`data: ${escapeHtml(prefix + buffer)}\n\n`);
        }
      }

      await Promise.all([
        pipeOutput(proc.stdout as ReadableStream<Uint8Array>),
        pipeOutput(proc.stderr as ReadableStream<Uint8Array>, '[err] '),
      ]);

      const exitCode = await proc.exited;
      controller.enqueue(`event: done\ndata: ${exitCode}\n\n`);
      controller.close();
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
