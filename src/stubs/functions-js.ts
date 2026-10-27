// Studio HQ never calls Supabase Edge Functions; the build swaps that library for this stand-in (see storage-js.ts).
export const FunctionRegion = {};
export class FunctionsError extends Error {}
export class FunctionsFetchError extends FunctionsError {}
export class FunctionsHttpError extends FunctionsError {}
export class FunctionsRelayError extends FunctionsError {}
export class FunctionsClient {
  constructor(..._args: unknown[]) {}
}
