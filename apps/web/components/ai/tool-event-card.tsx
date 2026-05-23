"use client"

import {
  BoxIcon,
  CameraIcon,
  CheckIcon,
  CloudUploadIcon,
  Loader2Icon,
  LinkIcon,
  SquareChevronRightIcon,
  XIcon,
} from "lucide-react"

export type ToolEvent =
  | {
      kind: "createSandbox"
      id: string
      status: "loading" | "done" | "error"
      sandboxId?: string
      source?: "fresh" | "snapshot"
      message?: string
      error?: string
    }
  | {
      kind: "generateFiles"
      id: string
      status: "generating" | "done" | "error"
      paths: string[]
      error?: string
    }
  | {
      kind: "runCommand"
      id: string
      status: "executing" | "running" | "done" | "error"
      command: string
      args: string[]
      exitCode?: number
      stdout?: string
      stderr?: string
      error?: string
    }
  | {
      kind: "getSandboxURL"
      id: string
      status: "loading" | "done" | "error"
      url?: string
      port?: number
      error?: string
    }
  | {
      kind: "saveSnapshot"
      id: string
      status: "loading" | "done" | "error"
      snapshotId?: string
      expiresAt?: number
      error?: string
    }

function StatusIcon({ status }: { status: string }) {
  if (status === "error") {
    return <XIcon className="size-3.5 text-red-400" />
  }
  if (
    status === "loading" ||
    status === "executing" ||
    status === "waiting" ||
    status === "generating" ||
    status === "running"
  ) {
    return <Loader2Icon className="size-3.5 animate-spin text-zinc-400" />
  }
  return <CheckIcon className="size-3.5 text-emerald-400" />
}

function HeaderIcon({ kind }: { kind: ToolEvent["kind"] }) {
  switch (kind) {
    case "createSandbox":
      return <BoxIcon className="size-3.5" />
    case "generateFiles":
      return <CloudUploadIcon className="size-3.5" />
    case "runCommand":
      return <SquareChevronRightIcon className="size-3.5" />
    case "getSandboxURL":
      return <LinkIcon className="size-3.5" />
    case "saveSnapshot":
      return <CameraIcon className="size-3.5" />
  }
}

function headerLabel(event: ToolEvent): string {
  switch (event.kind) {
    case "createSandbox":
      if (event.status === "loading") return "Creating sandbox"
      if (event.status === "error") return "Sandbox creation failed"
      return event.source === "snapshot"
        ? "Sandbox restored from snapshot"
        : "Sandbox created"
    case "generateFiles":
      if (event.status === "generating") return "Generating files"
      if (event.status === "error") return "File generation failed"
      return `Wrote ${event.paths.length} file${event.paths.length === 1 ? "" : "s"}`
    case "runCommand":
      if (event.status === "executing") return "Executing"
      if (event.status === "running") return "Running in background"
      if (event.status === "error") return "Command failed"
      if (event.status === "done" && event.exitCode && event.exitCode !== 0) {
        return `Exited with code ${event.exitCode}`
      }
      return "Command finished"
    case "getSandboxURL":
      if (event.status === "loading") return "Resolving preview URL"
      if (event.status === "error") return "Could not get preview URL"
      return "Preview URL ready"
    case "saveSnapshot":
      if (event.status === "loading") return "Saving snapshot"
      if (event.status === "error") return "Snapshot failed"
      return "Snapshot saved"
  }
}

export function ToolEventCard({ event }: { event: ToolEvent }) {
  return (
    <div className="my-2 rounded-md border border-white/10 bg-zinc-950/60 px-3 py-2 font-mono text-xs">
      <div className="flex items-center gap-2 text-zinc-300">
        <HeaderIcon kind={event.kind} />
        <span className="font-semibold">{headerLabel(event)}</span>
        <span className="ml-auto">
          <StatusIcon status={event.status} />
        </span>
      </div>
      <ToolBody event={event} />
    </div>
  )
}

function ToolBody({ event }: { event: ToolEvent }) {
  if (event.kind === "createSandbox") {
    return (
      <div className="mt-1.5 space-y-0.5 pl-5 text-zinc-400">
        {event.sandboxId ? <div>id: {event.sandboxId}</div> : null}
        {event.error ? <div className="text-red-400">{event.error}</div> : null}
      </div>
    )
  }

  if (event.kind === "generateFiles") {
    return (
      <div className="mt-1.5 space-y-0.5 pl-5">
        {event.paths.map((path, idx) => (
          <div className="text-zinc-300" key={`${path}-${idx}`}>
            {path}
          </div>
        ))}
        {event.error ? <div className="text-red-400">{event.error}</div> : null}
      </div>
    )
  }

  if (event.kind === "runCommand") {
    const cmd = `${event.command}${event.args.length ? " " + event.args.join(" ") : ""}`
    return (
      <div className="mt-1.5 space-y-1 pl-5 text-zinc-400">
        <div className="text-zinc-300">$ {cmd}</div>
        {event.stdout?.trim() ? (
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-zinc-400">
            {event.stdout.trim()}
          </pre>
        ) : null}
        {event.stderr?.trim() ? (
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-red-400/80">
            {event.stderr.trim()}
          </pre>
        ) : null}
        {event.error ? <div className="text-red-400">{event.error}</div> : null}
      </div>
    )
  }

  if (event.kind === "getSandboxURL") {
    return (
      <div className="mt-1.5 space-y-0.5 pl-5">
        {event.url ? (
          <a
            className="text-emerald-400 underline-offset-2 hover:underline"
            href={event.url}
            rel="noreferrer"
            target="_blank"
          >
            {event.url}
          </a>
        ) : event.port ? (
          <span className="text-zinc-400">port {event.port}</span>
        ) : null}
        {event.error ? <div className="text-red-400">{event.error}</div> : null}
      </div>
    )
  }

  if (event.kind === "saveSnapshot") {
    return (
      <div className="mt-1.5 space-y-0.5 pl-5 text-zinc-400">
        {event.snapshotId ? <div>id: {event.snapshotId}</div> : null}
        {event.expiresAt ? (
          <div>expires {new Date(event.expiresAt).toLocaleString()}</div>
        ) : null}
        {event.error ? <div className="text-red-400">{event.error}</div> : null}
      </div>
    )
  }

  return null
}
