// Runs once when the server process starts (not in the browser / edge).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { installProcessSafety } = await import("@/lib/processSafety");
  installProcessSafety();

  const { startMaintenance } = await import("@/lib/maintenance");
  startMaintenance();
}
