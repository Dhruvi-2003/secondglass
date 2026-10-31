export const staticPages = typeof __STATIC_PAGES__ !== "undefined" && __STATIC_PAGES__;
export const lensMounts = [
  "Nikon Z", "Nikon F", "Sony E", "Sony A",
  "Canon EF", "Canon EF-S", "Canon RF", "Canon RF-S",
  "Fujifilm X", "Fujifilm GFX", "L-Mount", "Micro Four Thirds",
];
export const money = (n) =>
  n == null
    ? "Not disclosed"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: n % 100 === 0 ? 0 : 2,
      }).format(n / 100);
export const disclosed = (n, suffix = "") =>
  n == null ? "Not disclosed" : `${n}${suffix}`;
export const coverage = (x) =>
  x === "FULL_FRAME"
    ? "Full-frame"
    : x === "APS_C"
      ? "APS-C"
      : "Coverage unknown";
export const optical = (x) =>
  x === "PRESENT"
    ? "Present — seller disclosed"
    : x === "ABSENT"
      ? "Absent — seller reports"
      : "Not disclosed";
export const yesno = (x) => (x == null ? "Not disclosed" : x ? "Yes" : "No");
export const ago = (value) => {
  const hours = Math.max(
    0,
    Math.floor((Date.now() - new Date(value)) / 3600000),
  );
  return hours < 1
    ? "Just observed"
    : hours < 24
      ? `${hours}h ago`
      : `${Math.floor(hours / 24)}d ago`;
};
export function quality(o) {
  const statuses = [o.fungus, o.haze, o.scratches];
  return statuses.includes("PRESENT")
    ? { tone: "warn", label: "Optical issue disclosed" }
    : statuses.includes("UNKNOWN")
      ? { tone: "unknown", label: "Optical details missing" }
      : { tone: "clear", label: "No optical issues reported" };
}
export async function api(url, options = {}) {
  if (staticPages) return (await import("./pages-api.mjs")).snapshotRequest(url,options);
  const response = await fetch(url, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server did not return a usable response. Please retry.",
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Too many requests. Please try again in a minute."
        : data.error || data.detail || "Something went wrong. Please retry.",
    );
  return data;
}
export const post = (url, data) =>
  api(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
export function readSaved() {
  try {
    const v = JSON.parse(localStorage.getItem("secondglass.saved") || "[]");
    return Array.isArray(v)
      ? [
          ...new Set(
            v.filter(
              (x) => typeof x === "string" && /^[a-zA-Z0-9-]{1,36}$/.test(x),
            ),
          ),
        ].slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
export function trackingAllowed() {
  if (staticPages) return false;
  try {
    return (
      navigator.doNotTrack !== "1" &&
      !navigator.globalPrivacyControl &&
      localStorage.getItem("secondglass.usage") !== "off"
    );
  } catch {
    return false;
  }
}
export function event(name) {
  if (trackingAllowed()) post("/api/events", { event: name }).catch(() => {});
}
export const defaults = {
  q: "",
  maxPrice: 60000,
  brand: "",
  coverage: "",
  kind: "",
  retailer: "",
  listingType: "",
  mount: "",
  freshOnly: false,
  inStockOnly: false,
  includeSoldOut: false,
  disclosedClearOnly: false,
  sort: "price",
};
export function initialFilters(search = location.search) {
  const p = new URLSearchParams(search);
  return {
    ...defaults,
    q: (p.get("q") || "").slice(0, 100),
    maxPrice: Math.min(
      1000000,
      Math.max(100, Number(p.get("maxPrice")) || 60000),
    ),
    brand: ["Sony", "Sigma", "Tamron", "Canon", "Nikon", "Fujifilm"].includes(p.get("brand"))
      ? p.get("brand")
      : "",
    coverage: ["FULL_FRAME", "APS_C"].includes(p.get("coverage"))
      ? p.get("coverage")
      : "",
    kind: ["prime", "zoom"].includes(p.get("kind")) ? p.get("kind") : "",
    sort: ["price", "price-desc", "recent"].includes(p.get("sort"))
      ? p.get("sort")
      : "price",
    mount: lensMounts.includes(p.get("mount")) ? p.get("mount") : "",
    retailer: (p.get("retailer") || "").slice(0, 80),
    listingType: ["NEW", "USED", "REFURBISHED"].includes(p.get("listingType"))
      ? p.get("listingType")
      : "",
    freshOnly: p.get("freshOnly") === "true",
    inStockOnly: p.get("inStockOnly") === "true",
    includeSoldOut: p.get("includeSoldOut") === "true",
    disclosedClearOnly: p.get("disclosedClearOnly") === "true",
  };
}
