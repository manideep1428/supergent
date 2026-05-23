"use client"

import { useEffect, useMemo, useState } from "react"
import type { BundledLanguage } from "shiki"

const EXT_TO_LANG: Record<string, BundledLanguage> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "jsonc",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  md: "markdown",
  mdx: "mdx",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  ps1: "powershell",
  dockerfile: "dockerfile",
  makefile: "makefile",
  ini: "ini",
  env: "shell",
  prisma: "prisma",
  graphql: "graphql",
  gql: "graphql",
  vue: "vue",
  svelte: "svelte",
}

function langFromPath(path: string): BundledLanguage {
  const lower = path.toLowerCase()
  const base = lower.split(/[\\/]/).pop() ?? lower

  if (base === "dockerfile") return "dockerfile"
  if (base === "makefile") return "makefile"
  if (base.startsWith(".env")) return "shell"

  const ext = base.includes(".") ? base.split(".").pop() ?? "" : ""
  return EXT_TO_LANG[ext] ?? ("text" as BundledLanguage)
}

type Props = {
  path: string
  content: string
  loading?: boolean
  error?: string | null
}

export function CodeViewer({ path, content, loading, error }: Props) {
  const lang = useMemo(() => langFromPath(path), [path])
  const [html, setHtml] = useState<string>("")
  const [highlighting, setHighlighting] = useState(false)
  const lineCount = useMemo(() => content.split("\n").length, [content])

  useEffect(() => {
    if (!content) {
      setHtml("")
      return
    }

    let cancelled = false
    setHighlighting(true)

    ;(async () => {
      try {
        const { codeToHtml } = await import("shiki")
        const result = await codeToHtml(content, {
          lang,
          theme: "dark-plus",
        })
        if (!cancelled) setHtml(result)
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          // Fall back to plain text so the viewer is still useful when shiki fails.
          const escaped = content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
          setHtml(`<pre><code>${escaped}</code></pre>`)
        }
      } finally {
        if (!cancelled) setHighlighting(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [content, lang])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-500">
        Loading file...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs text-red-400">
        {error}
      </div>
    )
  }

  if (!content) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-500">
        Select a file to view its contents.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1e1e1e] text-[13px]">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#252526] px-3 py-2">
        <span className="truncate font-mono text-xs text-zinc-300">{path}</span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
          {lang}
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1 overflow-auto font-mono leading-[1.55]">
        <div
          aria-hidden
          className="sticky left-0 shrink-0 select-none border-r border-white/5 bg-[#1e1e1e] px-3 py-3 text-right text-zinc-600"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <div
          className="min-w-0 flex-1 px-4 py-3 [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {highlighting ? (
          <div className="pointer-events-none absolute right-3 top-2 text-[10px] uppercase tracking-wide text-zinc-600">
            highlighting…
          </div>
        ) : null}
      </div>
    </div>
  )
}
