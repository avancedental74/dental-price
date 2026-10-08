import { normalizeDentaltix } from "./normalizer";
import { parseDentaltixNuxtFast, parseDentaltixProductHtml } from "./parser";
import type { DentaltixConnectorResult, DentaltixHealth } from "./types";

const USER_AGENT = "DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)";

export async function fetchDentaltixProduct(productUrl: string, fetchImpl: typeof fetch = fetch): Promise<DentaltixConnectorResult> {
  const response = await fetchImpl(productUrl, { headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) throw new Error("Dentaltix HTTP " + response.status);
  const html = await response.text();
  const raw = parseDentaltixNuxtFast(html, productUrl) ?? parseDentaltixProductHtml(html, productUrl);
  return { raw, offers: normalizeDentaltix(raw) };
}

export async function healthCheckDentaltix(url = "https://www.dentaltix.com/en/3m/filtek-supreme-xte-versatile-nanocomposite-syringe?sku=053M4910A3B", fetchImpl: typeof fetch = fetch): Promise<DentaltixHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const result = await fetchDentaltixProduct(url, fetchImpl);
    if (!result.raw.title || result.offers.length === 0) return { status: "amber", checkedAt, message: "Página accesible pero parser incompleto" };
    return { status: "green", checkedAt, message: result.offers.length + " oferta(s) normalizada(s)" };
  } catch (error) {
    return { status: "red", checkedAt, message: error instanceof Error ? error.message : "Error desconocido" };
  }
}