"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FileIcon,
  FileJsonIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  ImageIcon,
  KeyIcon,
  PackageIcon,
  SettingsIcon,
  TerminalIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

type FileNode = { type: "file"; name: string; path: string }
type FolderNode = {
  type: "folder"
  name: string
  path: string
  children: TreeNode[]
}
type TreeNode = FileNode | FolderNode

function splitParts(path: string) {
  return path.split(/[\\/]+/).filter(Boolean)
}

function buildTree(paths: string[]): TreeNode[] {
  const root: FolderNode = { type: "folder", name: "", path: "", children: [] }

  for (const full of paths) {
    const parts = splitParts(full)
    if (parts.length === 0) continue
    let cursor: FolderNode = root

    parts.forEach((name, idx) => {
      const isLast = idx === parts.length - 1
      const childPath = parts.slice(0, idx + 1).join("/")
      let child = cursor.children.find((n) => n.name === name)

      if (!child) {
        child = isLast
          ? ({ type: "file", name, path: childPath } as FileNode)
          : ({
              type: "folder",
              name,
              path: childPath,
              children: [],
            } as FolderNode)
        cursor.children.push(child)
      }

      if (!isLast && child.type === "folder") {
        cursor = child
      }
    })
  }

  const sortNode = (node: FolderNode) => {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const c of node.children) {
      if (c.type === "folder") sortNode(c)
    }
  }

  sortNode(root)
  return root.children
}

function getFileIcon(name: string): { Icon: LucideIcon; color: string } {
  const lower = name.toLowerCase()

  if (lower === "package.json" || lower === "package-lock.json") {
    return { Icon: PackageIcon, color: "text-rose-300" }
  }
  if (lower === "bun.lock" || lower === "yarn.lock" || lower === "pnpm-lock.yaml") {
    return { Icon: PackageIcon, color: "text-rose-200" }
  }
  if (
    lower === "tsconfig.json" ||
    lower.startsWith("tsconfig.") ||
    lower === "jsconfig.json" ||
    lower.endsWith(".config.ts") ||
    lower.endsWith(".config.js") ||
    lower.endsWith(".config.mjs")
  ) {
    return { Icon: SettingsIcon, color: "text-zinc-400" }
  }
  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) {
    return { Icon: PackageIcon, color: "text-blue-400" }
  }
  if (lower === "makefile") {
    return { Icon: TerminalIcon, color: "text-amber-400" }
  }
  if (lower.startsWith(".env")) {
    return { Icon: KeyIcon, color: "text-yellow-300" }
  }
  if (lower === "readme.md" || lower === "readme") {
    return { Icon: FileTextIcon, color: "text-blue-200" }
  }

  const ext = lower.includes(".") ? lower.split(".").pop() ?? "" : ""
  switch (ext) {
    case "ts":
    case "tsx":
      return { Icon: FileCodeIcon, color: "text-blue-400" }
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return { Icon: FileCodeIcon, color: "text-yellow-300" }
    case "json":
    case "jsonc":
      return { Icon: FileJsonIcon, color: "text-amber-300" }
    case "css":
    case "scss":
    case "sass":
    case "less":
      return { Icon: FileCodeIcon, color: "text-cyan-400" }
    case "html":
    case "htm":
    case "vue":
    case "svelte":
      return { Icon: FileCodeIcon, color: "text-orange-400" }
    case "md":
    case "mdx":
      return { Icon: FileTextIcon, color: "text-zinc-200" }
    case "yml":
    case "yaml":
      return { Icon: FileCodeIcon, color: "text-fuchsia-400" }
    case "toml":
      return { Icon: FileCodeIcon, color: "text-stone-400" }
    case "py":
      return { Icon: FileCodeIcon, color: "text-green-400" }
    case "rs":
      return { Icon: FileCodeIcon, color: "text-orange-300" }
    case "go":
      return { Icon: FileCodeIcon, color: "text-cyan-300" }
    case "java":
    case "kt":
      return { Icon: FileCodeIcon, color: "text-orange-400" }
    case "rb":
      return { Icon: FileCodeIcon, color: "text-red-400" }
    case "php":
      return { Icon: FileCodeIcon, color: "text-indigo-400" }
    case "sh":
    case "bash":
    case "zsh":
    case "fish":
    case "ps1":
      return { Icon: TerminalIcon, color: "text-emerald-400" }
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
    case "avif":
      return { Icon: ImageIcon, color: "text-pink-400" }
    default:
      return { Icon: FileIcon, color: "text-zinc-400" }
  }
}

const INDENT_PX = 12
const ROW_PADDING_LEFT = 8

type Props = {
  files: string[]
  selectedPath: string | null
  onSelect: (path: string) => void
}

export function FileExplorer({ files, selectedPath, onSelect }: Props) {
  const tree = React.useMemo(() => buildTree(files), [files])

  const ancestors = React.useMemo(() => {
    if (!selectedPath) return new Set<string>()
    const set = new Set<string>()
    const parts = splitParts(selectedPath)
    parts.slice(0, -1).reduce((prefix, part) => {
      const next = prefix ? `${prefix}/${part}` : part
      set.add(next)
      return next
    }, "")
    return set
  }, [selectedPath])

  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set(ancestors),
  )

  React.useEffect(() => {
    if (ancestors.size === 0) return
    setExpanded((prev) => {
      let mutated = false
      const next = new Set(prev)
      ancestors.forEach((a) => {
        if (!next.has(a)) {
          next.add(a)
          mutated = true
        }
      })
      return mutated ? next : prev
    })
  }, [ancestors])

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  if (tree.length === 0) {
    return (
      <div className="px-3 py-3 text-[11px] text-zinc-500">No files yet.</div>
    )
  }

  return (
    <div className="py-1">
      {tree.map((node) => (
        <TreeRow
          depth={0}
          expanded={expanded}
          key={node.path}
          node={node}
          onSelect={onSelect}
          onToggle={toggle}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  )
}

function TreeRow({
  depth,
  expanded,
  node,
  onSelect,
  onToggle,
  selectedPath,
}: {
  depth: number
  expanded: Set<string>
  node: TreeNode
  onSelect: (path: string) => void
  onToggle: (path: string) => void
  selectedPath: string | null
}) {
  if (node.type === "folder") {
    const isOpen = expanded.has(node.path)
    return (
      <>
        <button
          className="flex w-full items-center gap-1 px-2 py-1 text-left font-mono text-xs text-zinc-300 hover:bg-[#2a2d2e]"
          onClick={() => onToggle(node.path)}
          style={{ paddingLeft: ROW_PADDING_LEFT + depth * INDENT_PX }}
          title={node.path}
          type="button"
        >
          {isOpen ? (
            <ChevronDownIcon className="size-3.5 shrink-0 text-zinc-500" />
          ) : (
            <ChevronRightIcon className="size-3.5 shrink-0 text-zinc-500" />
          )}
          {isOpen ? (
            <FolderOpenIcon className="size-3.5 shrink-0 text-amber-300" />
          ) : (
            <FolderIcon className="size-3.5 shrink-0 text-amber-300" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen
          ? node.children.map((child) => (
              <TreeRow
                depth={depth + 1}
                expanded={expanded}
                key={child.path}
                node={child}
                onSelect={onSelect}
                onToggle={onToggle}
                selectedPath={selectedPath}
              />
            ))
          : null}
      </>
    )
  }

  const { Icon, color } = getFileIcon(node.name)
  const isActive = selectedPath === node.path
  // Files shift right by INDENT_PX so they line up under the folder name (past
  // the chevron column) without rendering a chevron of their own.
  const paddingLeft = ROW_PADDING_LEFT + depth * INDENT_PX + INDENT_PX + 4

  return (
    <button
      className={cn(
        "flex w-full items-center gap-1.5 px-2 py-1 text-left font-mono text-xs",
        isActive
          ? "bg-[#37373d] text-white"
          : "text-zinc-400 hover:bg-[#2a2d2e] hover:text-zinc-100",
      )}
      onClick={() => onSelect(node.path)}
      style={{ paddingLeft }}
      title={node.path}
      type="button"
    >
      <Icon className={cn("size-3.5 shrink-0", color)} />
      <span className="truncate">{node.name}</span>
    </button>
  )
}
