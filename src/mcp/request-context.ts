// Global headers storage for testing - enables echo_headers tool to access request headers
export let currentRequestHeaders: Record<string, string> = {};

// Setter for testing purposes
export function setCurrentRequestHeaders(headers: Record<string, string>): void {
  currentRequestHeaders = headers;
}
