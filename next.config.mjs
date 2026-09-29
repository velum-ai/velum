/** @type {import('next').NextConfig} */
const nextConfig = {
  // Left off: under SSR it was memoizing `disabled={<expr>}` props into an
  // undefined slot on the server and a real boolean on the client, tripping
  // hydration mismatches across several components. Not worth the churn.
  reactCompiler: false,
  allowedDevOrigins: ["192.168.1.128"],

  // self-contained server bundle for the Docker image (see Dockerfile)
  output: "standalone",

  // pdf-parse pulls in a native binary (@napi-rs/canvas); keep it un-bundled
  // and make sure its prebuilt binary actually ships in the standalone build.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],

  // ship the generated Prisma client + query engine, and pdf-parse's native
  // binary, with the standalone bundle
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/.prisma/client/**",
      "./node_modules/@prisma/client/**",
      "./node_modules/@napi-rs/canvas*/**",
    ],
  },
  outputFileTracingExcludes: {
    "*": ["data/**", ".data/**", "scripts/**", "**/*.md", ".git/**"],
  },

  poweredByHeader: false,

  // Security headers (CSP, X-Frame-Options, etc.) are set by the reverse
  // proxy (Caddy) in front of this app, not here, see deploy/Caddyfile.example.
  // Setting them in both places sends duplicate/conflicting header lines
  // for the same name, and browsers resolve that unpredictably (X-Frame-
  // Options in particular: a conflicting pair is treated as the most
  // restrictive value, which broke the DocPanel's same-origin iframe
  // preview even though Caddy's own override was correct).
};

export default nextConfig;
