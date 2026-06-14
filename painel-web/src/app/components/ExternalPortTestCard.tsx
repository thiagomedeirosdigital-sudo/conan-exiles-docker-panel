"use client";

export default function ExternalPortTestCard() {
  const actionsUrl = "https://github.com/thiagomedeirosdigital-sudo/conan-exiles-docker-panel/actions/workflows/external-port-test.yml";

  return (
    <div
      style={{
        background: "#1b1b1b",
        border: "1px solid #333",
        borderRadius: "12px",
        padding: "24px",
        marginTop: "24px",
        marginBottom: "24px",
        color: "#fff"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "20px",
          alignItems: "center",
          flexWrap: "wrap"
        }}
      >
        <div style={{ maxWidth: "680px" }}>
          <h2
            style={{
              color: "#ff9800",
              fontSize: "28px",
              margin: "0 0 12px 0"
            }}
          >
            🌎 Teste externo de portas
          </h2>

          <p style={{ margin: "0 0 10px 0", fontSize: "16px", color: "#e5e5e5" }}>
            Use o GitHub Actions para testar se o servidor responde fora da rede local.
          </p>

          <p style={{ margin: 0, fontSize: "14px", color: "#ffd36a" }}>
            Steam Query UDP OK = servidor visível. TCP/RCON fechado pode ser normal por segurança.
          </p>
        </div>

        <a
          href={actionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: "#ff9800",
            color: "#111",
            textDecoration: "none",
            padding: "14px 22px",
            borderRadius: "10px",
            fontWeight: 800,
            display: "inline-block",
            whiteSpace: "nowrap"
          }}
        >
          Abrir teste externo
        </a>
      </div>
    </div>
  );
}
