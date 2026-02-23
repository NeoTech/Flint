# Agent Lessons

## Rule Violations & Patterns to Avoid

### 1. Never kill processes — inform the user instead
**Date:** 2026-02-23  
**What happened:** Got `EADDRINUSE` on port 8080. Instead of stopping and informing the user, I ran `taskkill /PID ... /F` directly from a tool call.  
**Rule violated:** From `.github/copilot-instructions.md`:
> **EADDRINUSE error**: Inform the user the server is already running. Do **not** kill the process.

**Correct behaviour:**  
When port is in use, say: "The server is already running on port 8080. Please run `taskkill /IM bun.exe /F` (Windows) or `pkill bun` (macOS/Linux) to clear it, then restart."  
Never use `taskkill`, `kill`, `pkill`, or any process-termination command from agent tools.

**Prevention rule:** Before running any terminal command containing `taskkill`, `kill -9`, `pkill`, or `kill /F`, STOP. Re-read the EADDRINUSE rule. Inform the user instead.
