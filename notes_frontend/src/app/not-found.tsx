import React from "react";

export default function NotFound() {
  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4">
      <section className="card w-full max-w-lg p-6" role="alert" aria-live="assertive">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">
            404 – Page Not Found
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            The page you’re looking for doesn’t exist.
          </p>
        </header>
      </section>
    </main>
  );
}
