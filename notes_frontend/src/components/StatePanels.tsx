import * as React from "react";

export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function ErrorPanel({
  message,
  details,
  onRetry,
}: {
  message: string;
  details?: unknown;
  onRetry?: () => void;
}) {
  return (
    <Panel
      title="Something went wrong"
      description={message || "The request failed."}
    >
      {details ? (
        <pre className="mt-3 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-700">
          {typeof details === "string"
            ? details
            : JSON.stringify(details, null, 2)}
        </pre>
      ) : null}
      {onRetry ? (
        <button className="btn btn-primary mt-4" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </Panel>
  );
}

export function EmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel title={title} description={description}>
      {action ? <div className="mt-2">{action}</div> : null}
    </Panel>
  );
}
