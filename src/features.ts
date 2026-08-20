function readBooleanFeature(name: string, rawValue: string | undefined, fallback: boolean) {
  if (rawValue === undefined || rawValue === "") return fallback;
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  throw new Error(`${name} must be either "true" or "false", received ${JSON.stringify(rawValue)}`);
}

export const materialsEnabled = readBooleanFeature(
  "VITE_MATERIALS_ENABLED",
  import.meta.env.VITE_MATERIALS_ENABLED,
  false,
);
