import { Sandbox } from "@e2b/code-interpreter";
import { isTransient, wait } from "@/lib/httpRetry";
import { logError } from "@/lib/logger";

// The "run_python" tool's only backend: a fresh, disposable E2B sandbox per
// call, killed right after. The model decides when to call this (see the
// tool definition in chat/route.js); we never run code the user didn't ask
// the model to write.

const KEY = process.env.E2B_API_KEY || "";
// A pip install (e.g. reportlab, matplotlib) followed by real work routinely
// takes 15-30s; 20s was cutting that off mid-run, killing the sandbox right
// as the output file was being read back.
const TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 20_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const EXT_MIME = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  // code/config files a script might also hand back - all served as
  // text/plain, the DocPanel's viewer picks the syntax by file extension.
  py: "text/plain",
  js: "text/plain",
  jsx: "text/plain",
  ts: "text/plain",
  tsx: "text/plain",
  sh: "text/plain",
  html: "text/plain",
  css: "text/plain",
  sql: "text/plain",
  yaml: "text/plain",
  yml: "text/plain",
  xml: "text/plain",
  java: "text/plain",
  c: "text/plain",
  cpp: "text/plain",
  go: "text/plain",
  rs: "text/plain",
  rb: "text/plain",
  php: "text/plain",
  log: "text/plain",
};

export const codeExecConfigured = () => Boolean(KEY);

// Import name -> real pip package name, for the handful of common libraries
// where they differ. Anything not listed here is installed under its own
// import name, which is correct for the vast majority of packages
// (reportlab, matplotlib, pandas, numpy, requests, ...).
const PIP_NAME = {
  PIL: "pillow",
  cv2: "opencv-python",
  sklearn: "scikit-learn",
  bs4: "beautifulsoup4",
  yaml: "pyyaml",
  docx: "python-docx",
};

const MODULE_NOT_FOUND_RE = /No module named ['"]([\w.]+)['"]/;

// One deterministic install-and-retry, done here instead of leaving it to
// the model: models inconsistently combine "pip install" with the real work
// in one call, so a plain ModuleNotFoundError used to just fail the whole
// round-trip (or push the model toward hand-rolling the file format itself,
// which is far more error-prone than the real library). This makes a
// missing library a non-issue on the first try, every time.
async function installMissingModule(sandbox, pkg) {
  const install = `import subprocess, sys\nsubprocess.run([sys.executable, '-m', 'pip', 'install', '-q', ${JSON.stringify(pkg)}], check=True)`;
  const res = await sandbox.runCode(install, { timeoutMs: TIMEOUT_MS });
  return !res.error;
}

// Models sometimes forget to set output_file and just print the path instead
// (e.g. "Saved to /tmp/report.pdf"). If output_file didn't yield a file, look
// for a path with a known extension in what the code printed and try that.
const FILE_PATH_RE =
  /(\/[\w./-]+\.(pdf|png|jpe?g|webp|gif|csv|json|txt|md|py|jsx?|tsx?|sh|html|css|sql|ya?ml|xml|java|cpp|c|go|rs|rb|php|log))\b/i;

async function createSandbox() {
  try {
    return await Sandbox.create({ apiKey: KEY, timeoutMs: TIMEOUT_MS });
  } catch (err) {
    if (!isTransient(err)) throw err;
    await wait(300); // one retry - a cold-start connection blip, not a real outage
    return await Sandbox.create({ apiKey: KEY, timeoutMs: TIMEOUT_MS });
  }
}

// Reads back whatever the code wrote to outputFile, before the sandbox that
// wrote it is gone. A missing/oversized/unreadable file just means no
// download, never a failed tool call, the text result still stands on its own.
async function readOutputFile(sandbox, outputFile) {
  if (!outputFile) return null;
  try {
    const info = await sandbox.files.getInfo(outputFile).catch(() => null);
    if (info && info.size > MAX_FILE_BYTES) return null;
    const bytes = await sandbox.files.read(outputFile, { format: "bytes" });
    if (!bytes?.length || bytes.length > MAX_FILE_BYTES) return null;
    const ext = outputFile.split(".").pop()?.toLowerCase();
    const mime = EXT_MIME[ext];
    if (!mime) return null; // only hand back types the app already knows how to store
    return { buffer: Buffer.from(bytes), mime, name: outputFile.split("/").pop() };
  } catch {
    return null; // model asked for a path that was never written - not an error
  }
}

// -> { text, file }. text is always a string, for the model to read as the
// tool result. file is { buffer, mime, name } | null, for the user to
// download, present only if outputFile was given and actually written.
// Never throws: a dead sandbox provider degrades to an error string in text,
// not a broken chat.
export async function runCode(code, outputFile) {
  if (!codeExecConfigured()) {
    return { text: "error: code execution is not configured", file: null };
  }
  if (typeof code !== "string" || !code.trim()) {
    return { text: "error: no code given", file: null };
  }

  let sandbox;
  try {
    sandbox = await createSandbox();
    let exec;
    try {
      exec = await sandbox.runCode(code, { timeoutMs: TIMEOUT_MS });
    } catch (err) {
      if (!isTransient(err)) throw err;
      await wait(300); // one retry - the same connect-timeout blip createSandbox() already tolerates
      exec = await sandbox.runCode(code, { timeoutMs: TIMEOUT_MS });
    }

    if (exec.error?.name === "ModuleNotFoundError") {
      const missing = exec.error.value?.match(MODULE_NOT_FOUND_RE)?.[1];
      const pkg = missing && (PIP_NAME[missing] || missing);
      if (pkg && (await installMissingModule(sandbox, pkg))) {
        exec = await sandbox.runCode(code, { timeoutMs: TIMEOUT_MS });
      }
    }

    if (exec.error) {
      return { text: `error: ${exec.error.name}: ${exec.error.value}`, file: null };
    }
    const parts = [exec.text, exec.logs.stdout.join(""), exec.logs.stderr.join("")]
      .filter(Boolean);
    const out = parts.join("\n").trim();
    let file = await readOutputFile(sandbox, outputFile);
    if (!file) {
      const guessed = out.match(FILE_PATH_RE)?.[1];
      if (guessed && guessed !== outputFile) file = await readOutputFile(sandbox, guessed);
    }
    return {
      text: (out || (file ? `wrote ${file.name}` : "(no output)")).slice(0, MAX_OUTPUT_CHARS),
      file,
    };
  } catch (err) {
    logError("code_exec_failed", err);
    return { text: "error: sandbox failed to run this code", file: null };
  } finally {
    await sandbox?.kill().catch(() => {});
  }
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("codeExec.js")) {
  const { default: assert } = await import("node:assert");

  assert.strictEqual(codeExecConfigured(), false); // no E2B_API_KEY in test
  assert.deepStrictEqual(await runCode("print(1)"), {
    text: "error: code execution is not configured",
    file: null,
  });
  assert.deepStrictEqual(await runCode(""), {
    text: "error: code execution is not configured",
    file: null,
  });

  console.log("codeExec.js self-check OK");
}
