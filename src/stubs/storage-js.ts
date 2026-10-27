// Studio HQ never uses Supabase Storage, so the build swaps the storage library (about 100 KB) for this empty
// stand-in. supabase-js only constructs it; nothing here is ever called. Remove the alias in vite.config.ts if
// the page ever needs file storage.
export class StorageApiError extends Error {}
export class StorageClient {
  constructor(..._args: unknown[]) {}
}
