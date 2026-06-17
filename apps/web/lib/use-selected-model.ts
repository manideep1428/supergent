"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * localStorage key used to remember the user's last-picked chat model id.
 * Bump this if the storage shape ever changes.
 */
export const SELECTED_MODEL_STORAGE_KEY = "selected_model_id"

/**
 * Default model id used when nothing valid is stored. Kept as a constant so
 * both the home page and the chat page agree on the same default.
 */
export const DEFAULT_MODEL_ID = "gpt-5.5"

function readStoredId(validIds: readonly string[]): string | null {
    if (typeof window === "undefined") return null
    try {
        const stored = window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY)
        if (stored && validIds.includes(stored)) return stored
    } catch {
        // localStorage may be unavailable (SSR, privacy mode, quota errors);
        // silently fall through to the default.
    }
    return null
}

function writeStoredId(id: string) {
    if (typeof window === "undefined") return
    try {
        window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, id)
    } catch {
        // Storage quota or disabled storage - ignore. The selection will still
        // work for the current session.
    }
}

/**
 * Persisted model selector state. Returns a `[model, setModel]` tuple where
 * `setModel` also writes through to localStorage. On mount, hydrates from
 * localStorage if a previously-saved id is still valid; otherwise keeps the
 * supplied fallback (default: "gpt-5.5").
 *
 * SSR-safe: useState starts with the fallback so the server-rendered HTML
 * matches the initial client render, then a mount effect upgrades to the
 * stored value (one extra render at most, no hydration mismatch).
 */
export function useSelectedModel(
    validIds: readonly string[],
    fallbackId: string = DEFAULT_MODEL_ID,
) {
    const initial = validIds.includes(fallbackId)
        ? fallbackId
        : (validIds[0] ?? fallbackId)

    const [model, setModelState] = useState<string>(initial)

    useEffect(() => {
        const stored = readStoredId(validIds)
        if (stored && stored !== model) {
            setModelState(stored)
        }
        // We only want to hydrate once on mount; `validIds` is a static list.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const setModel = useCallback((next: string) => {
        setModelState(next)
        writeStoredId(next)
    }, [])

    return [model, setModel] as const
}
