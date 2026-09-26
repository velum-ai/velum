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

  // Baseline security headers. A reverse proxy may override or extend these.
  // CSP allows inline (Next needs it) plus the Turnstile origin. Dodo Payments
  // checkout is a full-page `location` redirect to their domain, which CSP does
  // not gate, so it needs no entry here. 'unsafe-eval' is added only outside
  // production, where React dev needs it.
  async headers() {
    const dev = process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : "";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${dev} https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
