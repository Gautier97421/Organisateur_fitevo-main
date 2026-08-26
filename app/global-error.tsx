"use client"

/**
 * Dernier filet de sécurité : une erreur survenue dans le layout racine lui-même.
 * Ce composant remplace tout le document (html/body inclus) et ne peut donc
 * dépendre d'aucun style ou provider de l'application.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center", color: "#111827" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Application indisponible
        </h1>
        <p style={{ color: "#4b5563", marginBottom: "1.5rem" }}>
          Une erreur inattendue empêche le chargement de l'application.
        </p>
        {error.digest && (
          <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginBottom: "1.5rem" }}>
            Référence : {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{ padding: "0.5rem 1rem", border: "1px solid #d1d5db", borderRadius: "0.375rem", background: "#fff", cursor: "pointer" }}
        >
          Réessayer
        </button>
      </body>
    </html>
  )
}
