"use client";

import * as React from "react";
import { notesApi } from "@/lib/notesApi";
import type { ApiError, Note } from "@/lib/types";
import { IconPlus, IconSearch, IconSpinner, IconTrash } from "@/components/Icons";
import { EmptyPanel, ErrorPanel } from "@/components/StatePanels";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; error: ApiError }
  | { kind: "ready" };

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; error: ApiError }
  | { kind: "saved" };

function formatRelative(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

function normalizeApiError(err: unknown): ApiError {
  if (typeof err === "object" && err && "message" in err) {
    return err as ApiError;
  }
  if (err instanceof Error) return { message: err.message };
  return { message: "Unknown error", details: err };
}

/**
 * Flow name: NotesUiFlow
 * Single entrypoint: Home() page component
 *
 * Contract:
 * - Loads notes list on mount.
 * - Supports search (debounced), create, select, edit, save, delete.
 * - UI always shows explicit loading/error/empty states.
 * - Errors are surfaced with useful debug details (status/details when available).
 */
export default function Home() {
  const [loadState, setLoadState] = React.useState<LoadState>({ kind: "idle" });
  const [saveState, setSaveState] = React.useState<SaveState>({ kind: "idle" });

  const [notes, setNotes] = React.useState<Note[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [searching, setSearching] = React.useState(false);

  // Editor state (draft)
  const selectedNote = React.useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );
  const [draftTitle, setDraftTitle] = React.useState("");
  const [draftContent, setDraftContent] = React.useState("");
  const [draftDirty, setDraftDirty] = React.useState(false);

  // Keep draft in sync when selection changes.
  React.useEffect(() => {
    setDraftTitle(selectedNote?.title ?? "");
    setDraftContent(selectedNote?.content ?? "");
    setDraftDirty(false);
    setSaveState({ kind: "idle" });
  }, [selectedNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reloadList = React.useCallback(async () => {
    setLoadState({ kind: "loading" });
    try {
      const data = await notesApi.list();
      setNotes(data ?? []);
      setLoadState({ kind: "ready" });

      // Ensure a deterministic selection.
      setSelectedId((prev) => {
        if (prev && data?.some((n) => n.id === prev)) return prev;
        return data && data.length > 0 ? data[0].id : null;
      });
    } catch (e) {
      setLoadState({ kind: "error", error: normalizeApiError(e) });
    }
  }, []);

  React.useEffect(() => {
    void reloadList();
  }, [reloadList]);

  // Debounced search.
  React.useEffect(() => {
    const handle = window.setTimeout(async () => {
      const q = search.trim();
      setSearching(true);
      try {
        const data = q ? await notesApi.search(q) : await notesApi.list();
        setNotes(data ?? []);
        setLoadState({ kind: "ready" });

        setSelectedId((prev) => {
          if (prev && data?.some((n) => n.id === prev)) return prev;
          return data && data.length > 0 ? data[0].id : null;
        });
      } catch (e) {
        setLoadState({ kind: "error", error: normalizeApiError(e) });
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [search]);

  const onCreate = React.useCallback(async () => {
    setSaveState({ kind: "saving" });
    try {
      const created = await notesApi.create({
        title: "Untitled",
        content: "",
      });
      // Prepend for instant visibility.
      setNotes((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setDraftDirty(false);
      setSaveState({ kind: "saved" });
    } catch (e) {
      setSaveState({ kind: "error", error: normalizeApiError(e) });
    }
  }, []);

  const onSave = React.useCallback(async () => {
    if (!selectedNote) return;
    setSaveState({ kind: "saving" });
    try {
      const updated = await notesApi.update(selectedNote.id, {
        title: draftTitle.trim() || "Untitled",
        content: draftContent,
      });

      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setDraftDirty(false);
      setSaveState({ kind: "saved" });
    } catch (e) {
      setSaveState({ kind: "error", error: normalizeApiError(e) });
    }
  }, [selectedNote, draftTitle, draftContent]);

  const onDelete = React.useCallback(async () => {
    if (!selectedNote) return;
    const ok = window.confirm(`Delete "${selectedNote.title || "Untitled"}"?`);
    if (!ok) return;

    setSaveState({ kind: "saving" });
    try {
      await notesApi.remove(selectedNote.id);
      setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id));
      setSelectedId((prevId) => {
        if (prevId !== selectedNote.id) return prevId;
        const remaining = notes.filter((n) => n.id !== selectedNote.id);
        return remaining.length ? remaining[0].id : null;
      });
      setSaveState({ kind: "idle" });
    } catch (e) {
      setSaveState({ kind: "error", error: normalizeApiError(e) });
    }
  }, [selectedNote, notes]);

  const canSave =
    !!selectedNote &&
    draftDirty &&
    saveState.kind !== "saving" &&
    loadState.kind !== "loading";

  return (
    <div className="app-shell">
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:py-10">
        {/* Header */}
        <header className="card card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Notes
            </h1>
            <span className="rounded-full border border-slate-200 bg-white/70 px-2 py-0.5 text-sm text-slate-500 shadow-sm">
              {loadState.kind === "ready" ? notes.length : "—"} total
            </span>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[380px]">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9 pr-12"
                placeholder="Search notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search notes"
              />
              {searching ? (
                <IconSpinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
              ) : (
                <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 text-xs text-slate-400 sm:inline">
                  <span className="kbd">Ctrl</span> <span className="kbd">K</span>
                </span>
              )}
            </div>

            <button className="btn btn-primary w-full sm:w-auto" onClick={onCreate}>
              <IconPlus className="h-4 w-4 text-blue-700" />
              New note
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:mt-6 lg:grid-cols-[380px_1fr]">
          {/* Sidebar */}
          <aside className="card overflow-hidden">
            <div className="border-b border-slate-200/80 px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                  Your notes
                </h2>
                <span className="text-xs text-slate-500">
                  {loadState.kind === "loading" ? "Loading…" : null}
                </span>
              </div>
            </div>

            <div className="max-h-[65vh] overflow-auto p-2 sm:p-3">
              {loadState.kind === "loading" ? (
                <div className="p-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <IconSpinner className="h-4 w-4 animate-spin text-slate-500" />
                    Loading notes…
                  </div>
                </div>
              ) : loadState.kind === "error" ? (
                <div className="p-2">
                  <ErrorPanel
                    message={loadState.error.message}
                    details={loadState.error.details}
                    onRetry={reloadList}
                  />
                </div>
              ) : notes.length === 0 ? (
                <div className="p-2">
                  <EmptyPanel
                    title={search.trim() ? "No matches" : "No notes yet"}
                    description={
                      search.trim()
                        ? "Try a different search term."
                        : "Create your first note to get started."
                    }
                    action={
                      <button className="btn btn-primary" onClick={onCreate}>
                        <IconPlus className="h-4 w-4 text-blue-700" />
                        Create a note
                      </button>
                    }
                  />
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {notes.map((n) => {
                    const active = n.id === selectedId;
                    return (
                      <li key={n.id}>
                        <button
                          className={[
                            "note-item w-full border px-3 py-2.5 text-left",
                            "focus-visible:shadow-[0_0_0_4px_rgba(59,130,246,0.25)]",
                            active
                              ? "note-item-active"
                              : "border-transparent hover:border-slate-200/80 hover:bg-white/60",
                          ].join(" ")}
                          onClick={() => setSelectedId(n.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold tracking-tight text-slate-900">
                                {n.title?.trim() ? n.title : "Untitled"}
                              </div>
                              <div className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-slate-600">
                                {n.content?.trim() ? n.content : "No content"}
                              </div>
                            </div>
                            <div className="shrink-0 text-[11px] text-slate-400">
                              {formatRelative(n.updated_at ?? n.created_at) ?? ""}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Main editor */}
          <main className="card p-4 sm:p-5">
            {loadState.kind === "error" ? (
              <ErrorPanel
                message={loadState.error.message}
                details={loadState.error.details}
                onRetry={reloadList}
              />
            ) : !selectedNote ? (
              <EmptyPanel
                title="Select a note"
                description="Choose a note from the list, or create a new one."
                action={
                  <button className="btn btn-primary" onClick={onCreate}>
                    <IconPlus className="h-4 w-4 text-blue-700" />
                    New note
                  </button>
                }
              />
            ) : (
              <div className="flex h-full flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">
                      {selectedNote.updated_at || selectedNote.created_at ? (
                        <>
                          Last updated:{" "}
                          {formatRelative(selectedNote.updated_at ?? selectedNote.created_at)}
                        </>
                      ) : (
                        " "
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      ID: <span className="font-mono">{selectedNote.id}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn"
                      onClick={onSave}
                      disabled={!canSave}
                      aria-disabled={!canSave}
                      title={canSave ? "Save changes" : "No changes to save"}
                    >
                      {saveState.kind === "saving" ? (
                        <IconSpinner className="h-4 w-4 animate-spin text-slate-500" />
                      ) : null}
                      Save
                    </button>

                    <button className="btn btn-danger" onClick={onDelete}>
                      <IconTrash className="h-4 w-4 text-red-600" />
                      Delete
                    </button>
                  </div>
                </div>

                {saveState.kind === "error" ? (
                  <div
                    className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700"
                    role="alert"
                  >
                    <div className="font-semibold">Save failed</div>
                    <div className="mt-1">{saveState.error.message}</div>
                  </div>
                ) : saveState.kind === "saved" ? (
                  <div
                    className="rounded-xl border border-slate-200 bg-white/60 p-3 text-sm text-slate-700"
                    role="status"
                  >
                    <span className="font-semibold">Saved.</span>{" "}
                    <span className="text-slate-600">
                      Your changes are up to date.
                    </span>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Title
                    </label>
                    <input
                      className="input mt-1"
                      value={draftTitle}
                      onChange={(e) => {
                        setDraftTitle(e.target.value);
                        setDraftDirty(true);
                      }}
                      placeholder="Untitled"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700">
                      Content
                    </label>
                    <textarea
                      className="input mt-1 min-h-[360px] resize-y"
                      value={draftContent}
                      onChange={(e) => {
                        setDraftContent(e.target.value);
                        setDraftDirty(true);
                      }}
                      placeholder="Write something…"
                    />
                    <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        {draftDirty ? (
                          <span className="text-slate-700">Unsaved changes</span>
                        ) : (
                          <span className="text-slate-400">Saved</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{draftContent.length.toLocaleString()} chars</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400">
                          Tip: keep notes short and searchable
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="mt-8 text-center text-xs text-slate-500">
          Powered by a REST API. Configure{" "}
          <span className="font-mono">NEXT_PUBLIC_NOTES_API_BASE_URL</span> to
          point at <span className="font-mono">notes_backend</span>.
        </footer>
      </div>
    </div>
  );
}
