import { get, set, del } from 'idb-keyval'
import type { PersistStorage, StorageValue } from 'zustand/middleware'

/**
 * Adapter de storage do Zustand `persist` sobre IndexedDB (via idb-keyval) em vez de
 * localStorage. Resolve a dívida D2 da auditoria: renders e thumbnails do histórico são
 * blobs/base64 que facilmente estouram a cota de ~5-10MB do localStorage.
 */
export function createIdbStorage<T>(): PersistStorage<T> {
  return {
    getItem: async (name) => {
      const value = await get<StorageValue<T>>(name)
      return value ?? null
    },
    setItem: async (name, value) => {
      await set(name, value)
    },
    removeItem: async (name) => {
      await del(name)
    },
  }
}
