"use client";

export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1rem",
          textAlign: "center",
          background: "#0a0a0a",
          color: "#ededed",
          fontFamily: "monospace",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 500, margin: 0 }}>
          something went wrong
        </h1>

        <button
          onClick={reset}
          style={{
            background: "none",
            border: "none",
            color: "#8a8a8a",
            textDecoration: "underline",
            cursor: "pointer",
            font: "inherit",
          }}
        >
          try again
        </button>
      </body>
    </html>
  );
}
