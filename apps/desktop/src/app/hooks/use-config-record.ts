import { useQuery } from '@tanstack/react-query'

import { getZorinConfigRecord } from '@/zorin'
import { queryClient, writeCache } from '@/lib/query-client'
import type { ZorinConfigRecord } from '@/types/zorin'

// One shared cache for the whole profile config record (`GET /api/config`).
// Every settings surface (MCP, model, config) reads and writes through this key
// so a save in one shows in the others, and revisiting a tab paints the cache
// instead of blanking on a fresh fetch.
//
// Distinct from session/hooks/use-zorin-config.ts, which is side-effecting —
// it pushes personality/cwd/voice/… into the session stores for live chat.
export const ZORIN_CONFIG_KEY = ['zorin-config-record'] as const

// staleTime 0 → serve cache instantly, background-revalidate on every mount.
export const useZorinConfigRecord = () =>
  useQuery({ queryKey: ZORIN_CONFIG_KEY, queryFn: getZorinConfigRecord, staleTime: 0 })

export const setZorinConfigCache = writeCache<ZorinConfigRecord>(ZORIN_CONFIG_KEY)

export const invalidateZorinConfig = () => queryClient.invalidateQueries({ queryKey: ZORIN_CONFIG_KEY })
