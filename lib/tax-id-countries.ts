/**
 * Countries where carriers require the recipient's national tax ID to clear
 * customs (e.g. Brazil's CPF/CNPJ, Mexico's RFC). Split out from lib/tax-id.ts
 * so client components (checkout forms) can check this without pulling in
 * Node's crypto module — see lib/tax-id.ts for the encryption utilities.
 */

export const TAX_ID_REQUIRED_COUNTRIES = new Set([
  "BR", // Brazil — CPF/CNPJ
  "MX", // Mexico — RFC
  "AR", // Argentina — CUIT/CUIL
  "CL", // Chile — RUT
  "PE", // Peru — DNI/RUC
  "ID", // Indonesia — NIK/NPWP
  "SA", // Saudi Arabia — National ID/Iqama
]);

export function requiresTaxId(country: string): boolean {
  return TAX_ID_REQUIRED_COUNTRIES.has(country);
}
