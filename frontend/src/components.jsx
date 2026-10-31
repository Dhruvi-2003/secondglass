import React, { useId, useEffect, useRef, useState } from "react";
import {brandLogo} from "./brands";
import {
  money,
  disclosed,
  coverage,
  optical,
  opticalCondition,
  warrantyLabel,
  returnsLabel,
  yesno,
  ago,
  quality,
} from "./lib";

export function Icon({ name, ...props }) {
  const paths = {
    search: "m21 21-5-5 M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16",
    bookmark: "M6 3h12v18l-6-4-6 4z",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    check: "m5 12 4 4L19 6",
    close: "m6 6 12 12M6 18 18 6",
    clock: "M12 8v5l3 2 M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0",
    info: "M12 11v6m0-10v1 M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0",
    compare: "M8 3v18M16 3v18M4 8h8M12 16h8",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
    external: "M14 3h7v7m0-7L10 14M10 3H3v18h18v-7",
    sliders: "M4 7h16M4 17h16M8 4v6m8 4v6",
    heart:
      "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8",
    chevron: "m8 5 7 7-7 7",
    refresh:
      "M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 14-1l1 6M4 12l1 6a8 8 0 0 0 14-1",
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name] || paths.info} />
    </svg>
  );
}
export function Aperture() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="m16 3 7 12M27 9H13M28 21l-7-12M16 29 9 17M5 23h14M4 11l7 12"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="m13 9 8 0 4 7-4 7h-8l-4-7z" fill="currentColor" opacity=".15" />
    </svg>
  );
}

export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null),
    label = useId();
  useEffect(() => {
    const node = ref.current;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : ""}
      aria-labelledby={label}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="modal-header">
        <h2 id={label}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function ProductRating({offer: o}) {
  if (o.product_rating == null || !o.product_rating_count) return <p className="product-rating missing-rating">{o.listing_details?.ratingStatus === "NO_REVIEWS" ? "No product reviews yet" : "Product rating unavailable"}</p>;
  const label = `${Number(o.product_rating).toFixed(1)}/5 · ${Number(o.product_rating_count).toLocaleString("en-IN")} ${o.product_rating_count_type} on ${o.seller}`;
  return <p className="product-rating"><span aria-hidden="true">★ </span>{o.source_url ? <a href={o.source_url} target="_blank" rel="noopener noreferrer" aria-label={`Product rating: ${label}`}>{label}</a> : label}</p>;
}
export function BrandMark({brand}) {
  const logo=brandLogo(brand), [failed,setFailed]=useState(false);
  return logo && !failed
    ? <img className={`brand-logo brand-logo-${logo.key}`} src={logo.src} alt={brand} width="96" height="32" decoding="async" onError={()=>setFailed(true)} />
    : <span>{brand}</span>;
}
export function ListingEvidence({offer}) {
  const entries=offer.listing_details?.evidence || [];
  if(!entries.length) return <p className="fine-print">Additional policy and condition details have not been captured for this listing.</p>;
  return <details className="listing-evidence">
    <summary>Sources for these details ({entries.length})</summary>
    <p className="fine-print">Product-family claims may cover multiple variants. Store policies can have product exclusions. Captured {new Date(offer.observed_at).toLocaleString("en-IN")}.</p>
    <ul>{entries.map((e,i)=><li key={i}><strong>{e.field === "returns" ? "Returns" : e.field[0].toUpperCase()+e.field.slice(1)}</strong> · {e.scope === "STORE_POLICY" ? "Store policy" : e.scope === "PRODUCT_FAMILY" ? "Product family" : "Product listing"}<p>{e.text}</p><a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">Read source</a></li>)}</ul>
  </details>;
}
export function OfferCard({
  offer: o,
  saved,
  selected,
  full,
  onSave,
  onCompare,
  onDetails,
}) {
  const state = quality(o);
  return (
    <article className={`offer-card text-offer ${selected ? "selected-card" : ""}`}>
      <div className="offer-heading">
        <span className="condition-heading">
          {o.condition_label}
          <span>
            {o.listing_type === "NEW" ? "Retail listing" : "Seller description"}
          </span>
        </span>
        <button
          className={`icon-button save-button ${saved ? "saved" : ""}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${o.model} from ${o.seller}`}
          aria-pressed={saved}
          onClick={onSave}
        >
          <Icon name="bookmark" />
        </button>
      </div>
      <div className="offer-body">
        <div className="brand-row">
          <BrandMark brand={o.brand} />
          <span>{coverage(o.coverage)}</span>
        </div>
        <h3>
          <button onClick={onDetails}>{o.model}</button>
        </h3>
        <p className="lens-meta">
          {o.mount || "Mount undisclosed"} <span>·</span>{" "}
          {o.model_code || "Exact variant unconfirmed"}
        </p>
        <ProductRating offer={o} />
        <div className={`optics-pill ${state.tone}`}>
          <Icon name={state.tone === "clear" ? "check" : "info"} />
          {state.label}
        </div>
        <div className="offer-terms">
          <span>
            {warrantyLabel(o)}
          </span>
          <span>{returnsLabel(o)}</span>
        </div>
        <div className="price-row">
          <strong>{money(o.price_paise)}</strong>
          <span
            className={`stock ${o.availability === "IN_STOCK" ? "" : "uncertain"}`}
          >
            <i />
            {o.availability === "IN_STOCK"
              ? "In stock"
              : o.availability === "OUT_OF_STOCK"
                ? "Sold out"
                : o.availability === "BACKORDER" ? "Backorder" : "Stock unknown"}
          </span>
        </div>
        <p className="shipping">
          {o.shipping_paise == null
            ? "Shipping not disclosed"
            : o.shipping_paise === 0
              ? "Free shipping advertised"
              : `+ ${money(o.shipping_paise)} shipping`}
        </p>
        <div className="seller-row">
          <span>{o.seller}</span>
          <span
            className={o.stale ? "stale" : ""}
            title={new Date(o.observed_at).toLocaleString()}
          >
            <Icon name="clock" />
            {ago(o.observed_at)}
            {o.stale ? " · stale" : ""}
          </span>
        </div>
        <div className="card-actions">
          <label>
            <input
              type="checkbox"
              checked={selected}
              disabled={full && !selected}
              onChange={onCompare}
            />
            Compare
          </label>
          <button onClick={onDetails}>Details</button>
          {!o.demo && o.source_url ? (
            <a
              className="seller-link"
              href={o.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {o.availability === "OUT_OF_STOCK"
                  ? "Check seller"
                  : "View seller"}{" "}
              <Icon name="external" />
            </a>
          ) : (
            <button onClick={onDetails}>
              View listing <Icon name="arrow" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
export function Comparison({ data }) {
  const rows = [
    ["Purchase type", (o) => o.listing_type || "USED"],
    ["Platform / retailer", (o) => o.seller],
    ["Listed price", (o) => money(o.price_paise)],
    ["Product rating at this store", (o) => o.product_rating == null ? o.listing_details?.ratingStatus === "NO_REVIEWS" ? "No product reviews yet" : "Rating unavailable" : `${Number(o.product_rating).toFixed(1)}/5 · ${Number(o.product_rating_count).toLocaleString("en-IN")} ${o.product_rating_count_type} on ${o.seller}`],
    ["Manufacturer model code", (o) => o.model_code || "Not disclosed"],
    ["Mount", (o) => o.mount || "Not disclosed"],
    ["Sensor coverage", (o) => coverage(o.coverage)],
    [
      "Focal length",
      (o) =>
        o.focal_min === o.focal_max
          ? disclosed(o.focal_min, "mm")
          : `${disclosed(o.focal_min)}–${disclosed(o.focal_max)}mm`,
    ],
    ["Maximum aperture", (o) => disclosed(o.max_aperture)],
    ["Autofocus", (o) => yesno(o.autofocus)],
    ["Lens stabilization", (o) => yesno(o.stabilized)],
    ["Seller’s condition grade", (o) => o.condition_label],
    ["Fungus", (o) => opticalCondition(o, "fungus")],
    ["Optical scratches", (o) => opticalCondition(o, "scratches")],
    ["Haze", (o) => opticalCondition(o, "haze")],
    ["Source listing summary", (o) => o.condition_notes],
    ["Included accessories", (o) => o.accessories || "Not disclosed"],
    ["Warranty", warrantyLabel],
    ["Warranty scope", (o) => o.warranty_details || "Not verified"],
    ["Returns", returnsLabel],
    ["Return conditions", (o) => o.listing_details?.returnDetails || "Not verified"],
    ["Shipping", (o) => money(o.shipping_paise)],
    [
      "Price + disclosed shipping",
      (o) =>
        o.shipping_paise == null
          ? "Total unknown"
          : money(o.price_paise + o.shipping_paise),
    ],
    ["Availability", (o) => o.availability.replaceAll("_", " ").toLowerCase()],
    [
      "Last observed",
      (o) =>
        `${new Date(o.observed_at).toLocaleString("en-IN")}${o.stale ? " · stale" : ""}`,
    ],
  ];
  return (
    <>
      <div
        className={`comparison-verdict ${data.modelMatch === "MATCHING_VARIANT" ? "match" : ""}`}
      >
        <Icon
          name={data.modelMatch === "MATCHING_VARIANT" ? "check" : "info"}
        />
        <div>
          <strong>
            {data.modelMatch === "MATCHING_VARIANT"
              ? "Same disclosed lens variant"
              : data.modelMatch === "INSUFFICIENT_INFORMATION"
                ? "Variant match cannot be confirmed"
                : "Different lens variants"}
          </strong>
          <p>{data.notice}</p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <caption>
            Shaded rows highlight differences. Unknown values are never treated
            as equivalent condition.
          </caption>
          <thead>
            <tr>
              <th scope="col">The whole picture</th>
              {data.offers.map((o) => (
                <th key={o.id} scope="col">
                  {o.model}
                  <small>{o.seller}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, value]) => {
              const values = data.offers.map(value);
              return (
                <tr
                  key={name}
                  className={new Set(values).size > 1 ? "diff" : ""}
                >
                  <th scope="row">{name}</th>
                  {values.map((v, i) => (
                    <td
                      key={i}
                      className={
                        v.includes("Not disclosed") || v.includes("unknown")
                          ? "unknown-text"
                          : ""
                      }
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function PriceHistory({ history }) {
  const points = history.points,
    values = points.map((p) => p.price_paise),
    low = Math.min(...values),
    high = Math.max(...values),
    times = points.map((p) => new Date(p.observed_at).getTime()),
    first = times[0],
    last = times.at(-1);
  const coords = points.map((p, i) => [
    24 + ((times[i] - first) / Math.max(1, last - first)) * 452,
    98 - ((p.price_paise - low) / Math.max(1, high - low)) * 68,
  ]);
  return (
    <div className="price-history">
      {points.length > 1 && (
        <svg
          viewBox="0 0 500 122"
          role="img"
          aria-label="Price observations over time. Exact values are listed below."
        >
          <path
            d="M24 98h452M24 30h452"
            stroke="#dfdfd5"
            strokeDasharray="4 5"
          />
          <polyline
            points={coords.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="#bb4d32"
            strokeWidth="2.5"
          />
          {coords.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="4"
              fill="#bb4d32"
              stroke="#fff"
              strokeWidth="2"
            />
          ))}
        </svg>
      )}
      <div className="history-points">
        {points.map((p, i) => (
          <div key={i}>
            <span>
              {new Date(p.observed_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </span>
            <strong>{money(p.price_paise)}</strong>
            <small>{p.availability.replaceAll("_", " ").toLowerCase()}</small>
          </div>
        ))}
      </div>
      <p className="fine-print">
        {history.demo ? "Synthetic demo observations. " : ""}For this physical
        listing and variant only. Lines connect recorded observations; prices
        between checks are unknown.
      </p>
    </div>
  );
}
