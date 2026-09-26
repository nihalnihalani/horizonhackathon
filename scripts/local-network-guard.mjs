// Loaded only by the explicit local launcher and its workers, before application imports.
// All provider adapters use fetch. Refuse external fetch destinations and redirects in this mode.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password) {
    return Promise.reject(new Error("LOCAL_NETWORK_ONLY: hosted requests are disabled in this rehearsal"));
  }
  return nativeFetch(input, { ...init, redirect: "error" });
};
