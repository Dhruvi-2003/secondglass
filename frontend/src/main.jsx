import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Icon,
  Aperture,
  Modal,
  OfferCard,
  Comparison,
  PriceHistory,
  ProductRating,
} from "./components";
import {
  api,
  post,
  money,
  disclosed,
  coverage,
  optical,
  quality,
  defaults,
  initialFilters,
  readSaved,
  event,
  trackingAllowed,
  staticPages,
  lensMounts,
} from "./lib";
import "./style.css";
import { officialSites } from "./official-sites";

function App() {
  const [filters, setFilters] = useState(initialFilters),
    [page, setPage] = useState(0),
    [view, setView] = useState("all"),
    [offers, setOffers] = useState([]),
    [total, setTotal] = useState(0),
    [demo, setDemo] = useState(false),
    [sourceInfo, setSourceInfo] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  const [saved, setSaved] = useState(readSaved),
    [selected, setSelected] = useState([]),
    [modal, setModal] = useState(null),
    [comparison, setComparison] = useState(null),
    [detail, setDetail] = useState(null),
    [history, setHistory] = useState(null),
    [modalError, setModalError] = useState(""),
    [copyStatus, setCopyStatus] = useState(""),
    [status, setStatus] = useState(""),
    [mobileFilters, setMobileFilters] = useState(false);
  const [prompt, setPrompt] = useState(""),
    [suggestion, setSuggestion] = useState(null),
    [assistantBusy, setAssistantBusy] = useState(false),
    [assistantError, setAssistantError] = useState(""),
    [aiConfigured, setAiConfigured] = useState(false),
    [useAi, setUseAi] = useState(false),
    [assistantOpen, setAssistantOpen] = useState(false);
  const [feedback, setFeedback] = useState(""),
    [feedbackBusy, setFeedbackBusy] = useState(false),
    [feedbackError, setFeedbackError] = useState(""),
    [usageEnabled, setUsageEnabled] = useState(trackingAllowed);
  const requestVersion = useRef(0),
    catalogRef = useRef(null);
  useEffect(() => {
    event("page_view");
    api("/api/sources")
      .then(setSourceInfo)
      .catch(() =>
        setSourceInfo({
          sources: [],
          message: "Source coverage is temporarily unavailable.",
        }),
      );
    api("/api/search/capabilities")
      .then((x) => setAiConfigured(x.aiConfigured))
      .catch(() => {});
    const incoming = new URLSearchParams(location.search).get("compare");
    if (incoming) {
      const ids = [...new Set(incoming.split(","))]
        .filter((x) => /^[a-zA-Z0-9-]{1,36}$/.test(x))
        .slice(0, 3);
      if (ids.length >= 2) {
        setSelected(ids);
        openCompare(ids);
      }
    }
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        if (view === "saved" && !saved.length) {
          setOffers([]);
          setTotal(0);
          return;
        }
        const params = new URLSearchParams({
          ...filters,
          page,
          size: 12,
          ...(view === "saved" ? { ids: saved.join(",") } : {}),
        });
        const data = await api("/api/catalog?" + params, { signal: c.signal });
        setOffers(data.offers);
        setTotal(data.total);
        setDemo(data.demo);
      } catch (e) {
        if (e.name !== "AbortError")
          setError(
            e instanceof TypeError
              ? "The connection was interrupted. Your shortlist is still saved in this browser."
              : e.message,
          );
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [filters, page, view, saved, reload]);
  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value !== defaults[key]) params.set(key, String(value));
    if (modal === "compare" && selected.length >= 2)
      params.set("compare", selected.join(","));
    window.history.replaceState(
      {},
      "",
      location.pathname + (params.size ? "?" + params : ""),
    );
  }, [filters, modal, selected]);
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 5000);
    return () => clearTimeout(timer);
  }, [status]);
  function change(values) {
    setFilters((prev) => ({ ...prev, ...values }));
    setPage(0);
  }
  function reset() {
    setFilters({ ...defaults });
    setPage(0);
    setSuggestion(null);
  }
  function switchView(value) {
    setView(value);
    setPage(0);
    catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function toggleSave(id) {
    let next = saved.includes(id)
      ? saved.filter((x) => x !== id)
      : [...saved, id];
    if (next.length > 100) {
      setStatus("Your shortlist can hold up to 100 listings.");
      return;
    }
    setSaved(next);
    try {
      localStorage.setItem("secondglass.saved", JSON.stringify(next));
      setStatus(
        saved.includes(id)
          ? "Removed from your shortlist."
          : "Saved on this browser.",
      );
    } catch {
      setStatus("Saved for this session. Browser storage is unavailable.");
    }
  }
  function toggleCompare(id) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev,
    );
  }
  async function openCompare(ids = selected) {
    const version = ++requestVersion.current;
    setModal("compare");
    setComparison(null);
    setModalError("");
    setCopyStatus("");
    event("compare");
    try {
      const value = await api(
        "/api/compare?" + new URLSearchParams({ ids: ids.join(",") }),
      );
      if (version === requestVersion.current) setComparison(value);
    } catch (e) {
      if (version === requestVersion.current) setModalError(e.message);
    }
  }
  async function openDetails(id) {
    const version = ++requestVersion.current;
    setModal("details");
    setDetail(null);
    setHistory(null);
    setModalError("");
    event("detail");
    try {
      const [offer, points] = await Promise.all([
        api(`/api/offers/${id}`),
        api(`/api/offers/${id}/history`),
      ]);
      if (version === requestVersion.current) {
        setDetail(offer);
        setHistory(points);
      }
    } catch (e) {
      if (version === requestVersion.current) setModalError(e.message);
    }
  }
  function close() {
    requestVersion.current++;
    setModal(null);
    setModalError("");
  }
  async function interpret(e) {
    e.preventDefault();
    setAssistantBusy(true);
    setAssistantError("");
    setSuggestion(null);
    event("search_assist");
    try {
      setSuggestion(
        await post("/api/search/interpret", { text: prompt, useAi }),
      );
    } catch (e) {
      setAssistantError(e.message);
    } finally {
      setAssistantBusy(false);
    }
  }
  function applySuggestion() {
    const f = suggestion.filters;
    change({ ...defaults, ...f, maxPrice: f.maxPrice ?? defaults.maxPrice });
    setView("all");
    setStatus("Suggested filters applied. You can adjust every filter below.");
    setAssistantOpen(false);
    catalogRef.current?.scrollIntoView({ behavior: "smooth" });
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopyStatus("Link copied. It opens this catalogue on the same server.");
    } catch {
      setCopyStatus(
        "Could not copy automatically. Copy the URL from your browser.",
      );
    }
  }
  async function sendFeedback(kind) {
    setFeedbackBusy(true);
    setFeedbackError("");
    try {
      await post("/api/events", { event: "feedback_" + kind });
      setFeedback(kind);
    } catch (e) {
      setFeedbackError(e.message);
    } finally {
      setFeedbackBusy(false);
    }
  }
  function toggleUsage() {
    const next = !usageEnabled;
    try {
      localStorage.setItem("secondglass.usage", next ? "on" : "off");
      setUsageEnabled(next);
      setStatus(
        next
          ? "Aggregate usage counting enabled."
          : "Aggregate usage counting disabled.",
      );
    } catch {
      setStatus(
        "Could not save your preference. Your browser may block local storage.",
      );
    }
  }
  const activeCount = Object.keys(defaults).filter(
    (k) => k !== "sort" && filters[k] !== defaults[k],
  ).length;
  return (
    <>
      <a className="skip-link" href="#collection">
        Skip to lens listings
      </a>
      <div className="pilot-bar">
        <span className="pilot-dot" />
        <strong>{staticPages ? "RETAILER SNAPSHOT" : demo ? "INTERACTIVE PILOT" : "REAL SELLER LISTINGS"}</strong>
        <span>
          {staticPages ? `Published snapshot${sourceInfo?.generatedAt ? " · " + new Date(sourceInfo.generatedAt).toLocaleDateString() : ""} · confirm current prices with the seller` : demo
            ? "Sample inventory. Real comparison logic. No purchases."
            : "Observed prices · buy directly from the seller · no sign-up"}
        </span>
        <button onClick={() => setModal("about")}>
          About the pilot <Icon name="arrow" />
        </button>
      </div>
      <header className="site-header shell">
        <a href="./" className="wordmark" aria-label="SecondGlass home">
          <span>
            <Aperture />
          </span>
          Second<span className="wordmark-light">Glass</span>
          <sup>INDIA</sup>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={view === "all" ? "nav-active" : ""}
            onClick={() => switchView("all")}
          >
            Explore lenses
          </button>
          <button onClick={() => setModal("sources")}>Stores & coverage</button>
          <button onClick={() => setModal("about")}>How it works</button>
          <button className="shortlist-nav" onClick={() => switchView("saved")}>
            <Icon name="bookmark" />
            Shortlist <span>{saved.length}</span>
          </button>
        </nav>
      </header>
      <main>
        <section id="collection" ref={catalogRef} className="collection shell">
          <div className="collection-heading">
            <div>
              <p className="eyebrow">NEW · USED · REFURBISHED LENSES · INDIA</p>
              <h1>Find your next lens.</h1>
              <p className="intro">
                Compare prices, exact models and condition across Indian stores.
              </p>
            </div>
            <span className="mount-badge">
              <Aperture />
              Compare lens prices across India
            </span>
          </div>
          <div className="search-panel">
            <div className="search-main">
              <Icon name="search" />
              <input
                aria-label="Search lens models"
                placeholder="Search a lens, brand or model code…"
                value={filters.q}
                maxLength={100}
                onChange={(e) => change({ q: e.target.value })}
              />
              {filters.q && (
                <button
                  className="icon-button"
                  aria-label="Clear search"
                  onClick={() => change({ q: "" })}
                >
                  <Icon name="close" />
                </button>
              )}
              {!staticPages && <button
                className={`assist-toggle ${assistantOpen ? "active" : ""}`}
                aria-expanded={assistantOpen}
                onClick={() => setAssistantOpen(!assistantOpen)}
              >
                <Icon name="spark" />
                Describe your search
              </button>}
            </div>
            {assistantOpen && (
              <div className="assistant">
                <div className="assistant-title">
                  <strong>A little help finding your filters</strong>
                  <span>
                    {aiConfigured
                      ? "Optional AI available"
                      : "No-key mode · basic parser"}
                  </span>
                </div>
                <form onSubmit={interpret}>
                  <label className="sr-only" htmlFor="prompt">
                    Describe the lens you want
                  </label>
                  <input
                    id="prompt"
                    placeholder="e.g. A full-frame prime under ₹25,000"
                    value={prompt}
                    maxLength={500}
                    onChange={(e) => setPrompt(e.target.value)}
                    required
                  />
                  <button
                    className="primary"
                    disabled={assistantBusy || !prompt.trim()}
                  >
                    {assistantBusy ? "Reading…" : "Suggest filters"}
                    <Icon name="arrow" />
                  </button>
                </form>
                <div className="assistant-examples">
                  Try:{" "}
                  {[
                    "Full-frame prime under 25k",
                    "Sigma zoom below ₹40,000",
                    "50mm with clear optics",
                  ].map((x) => (
                    <button key={x} onClick={() => setPrompt(x)}>
                      {x}
                    </button>
                  ))}
                </div>
                {aiConfigured && (
                  <label className="ai-consent">
                    <input
                      type="checkbox"
                      checked={useAi}
                      onChange={(e) => setUseAi(e.target.checked)}
                    />
                    Use AI for this request. Sends this text to the configured
                    provider; avoid personal details.
                  </label>
                )}
                <p className="fine-print">
                  {aiConfigured ? "AI is optional. " : ""}The basic parser
                  recognizes budget, brand, prime/zoom, coverage and
                  focal-length keywords. Other requirements may be ignored. All
                  suggestions need your review.
                </p>
                {assistantError && (
                  <p role="alert" className="error-text">
                    {assistantError}
                  </p>
                )}
                {suggestion && (
                  <div className="suggestions" aria-live="polite">
                    <div className="suggested-chips">
                      {Object.entries(suggestion.filters)
                        .filter(
                          ([k, v]) => v !== null && v !== "" && v !== false,
                        )
                        .map(([k, v]) => (
                          <span key={k}>
                            {k === "maxPrice"
                              ? `Up to ${money(v * 100)}`
                              : k === "coverage"
                                ? coverage(v)
                                : k === "disclosedClearOnly"
                                  ? "Seller-reported clear optics"
                                  : String(v)}
                          </span>
                        ))}
                    </div>
                    <p>
                      {!Object.values(suggestion.filters).some(
                        (v) => v !== null && v !== "" && v !== false,
                      )
                        ? "No supported filters recognized. Try a budget, brand, focal length or prime/zoom preference. "
                        : ""}
                      {suggestion.note}
                    </p>
                    <button
                      className="secondary"
                      disabled={
                        !Object.values(suggestion.filters).some(
                          (v) => v !== null && v !== "" && v !== false,
                        )
                      }
                      onClick={applySuggestion}
                    >
                      Apply these filters <Icon name="check" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {!demo && (
            <div className="source-strip">
              <span>Compare offers from</span>
              <strong>
                {sourceInfo?.sources
                  ?.filter((s) => s.offers > 0)
                  .map((s) => s.name)
                  .join(" · ") || "Indian retailers"}
              </strong>
              <button onClick={() => setModal("sources")}>
                View coverage <Icon name="arrow" />
              </button>
            </div>
          )}
          <div className="browse-toolbar">
            <div className="view-tabs">
              <button
                className={view === "all" ? "active" : ""}
                onClick={() => switchView("all")}
              >
                All lenses
              </button>
              <button
                className={view === "saved" ? "active" : ""}
                onClick={() => switchView("saved")}
              >
                Saved <span>{saved.length}</span>
              </button>
            </div>
            <div className="quick-filters">
              <span>A place to start</span>
              <button
                className={filters.kind === "prime" ? "active" : ""}
                onClick={() =>
                  change({ kind: filters.kind === "prime" ? "" : "prime" })
                }
              >
                Prime lenses
              </button>
              <button
                className={filters.kind === "zoom" ? "active" : ""}
                onClick={() =>
                  change({ kind: filters.kind === "zoom" ? "" : "zoom" })
                }
              >
                Zoom lenses
              </button>
              <button
                className={filters.maxPrice === 25000 ? "active" : ""}
                onClick={() =>
                  change({
                    maxPrice: filters.maxPrice === 25000 ? 60000 : 25000,
                  })
                }
              >
                Under ₹25,000
              </button>
            </div>
          </div>
          <div className="mobile-filter-row">
            <button
              className="secondary"
              onClick={() => setMobileFilters(!mobileFilters)}
              aria-expanded={mobileFilters}
            >
              <Icon name="sliders" />
              Filters {activeCount > 0 && `(${activeCount})`}
            </button>
            <button className="text-button" onClick={reset}>
              Reset all
            </button>
          </div>
          <div className="catalog-layout">
            <aside
              className={`filters ${mobileFilters ? "show" : ""}`}
              aria-label="Filter lenses"
            >
              <div className="filters-heading">
                <h3>
                  <Icon name="sliders" />
                  Refine your search
                </h3>
                <button onClick={reset}>Reset</button>
              </div>
              <fieldset>
                <legend>Purchase type</legend>
                {[
                  ["", "All conditions"],
                  ["USED", "Used"],
                  ["NEW", "New"],
                  ["REFURBISHED", "Refurbished"],
                ].map(([value, label]) => (
                  <label className="check-label" key={value}>
                    <input
                      type="radio"
                      name="listingType"
                      checked={filters.listingType === value}
                      onChange={() => change({ listingType: value })}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              {!demo && (
                <fieldset>
                  <legend>Store / platform</legend>
                  <select
                    aria-label="Store or platform"
                    value={filters.retailer}
                    onChange={(e) => change({ retailer: e.target.value })}
                  >
                    <option value="">All stores</option>
                    {sourceInfo?.sources?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </fieldset>
              )}
              <fieldset>
                <legend>Budget</legend>
                <label className="budget-input">
                  <span>Up to ₹</span>
                  <input
                    type="number"
                    aria-label="Maximum price in rupees"
                    min="100"
                    max="1000000"
                    step="100"
                    value={filters.maxPrice}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n))
                        change({ maxPrice: Math.min(1000000, Math.max(0, n)) });
                    }}
                  />
                </label>
                <input
                  className="budget-range"
                  aria-label="Budget slider"
                  type="range"
                  min="5000"
                  max="100000"
                  step="1000"
                  value={Math.min(100000, Math.max(5000, filters.maxPrice))}
                  onChange={(e) => change({ maxPrice: Number(e.target.value) })}
                />
                <div className="range-labels">
                  <span>₹5,000</span>
                  <span>₹1,00,000</span>
                </div>
                <small>Listed price. Shipping shown separately.</small>
              </fieldset>
              <fieldset>
                <legend>Lens mount</legend>
                <select aria-label="Lens mount" value={filters.mount} onChange={e => change({mount:e.target.value})}>
                  <option value="">All mounts</option>
                  {lensMounts.map(mount => <option key={mount} value={mount}>{mount === "Fujifilm GFX" ? "Fujifilm GFX (G mount)" : mount === "L-Mount" ? "L-mount" : mount}</option>)}
                </select>
                <small>Different mounts are not interchangeable. Some mounts may have no verified listings yet.</small>
              </fieldset>
              <fieldset>
                <legend>Lens brand</legend>
                {["", "Sony", "Sigma", "Tamron", "Canon", "Nikon", "Fujifilm"].map((b) => (
                  <label className="check-label" key={b}>
                    <input
                      type="radio"
                      name="brand"
                      checked={filters.brand === b}
                      onChange={() => change({ brand: b })}
                    />
                    {b || "All brands"}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Sensor coverage</legend>
                <select
                  aria-label="Sensor coverage"
                  value={filters.coverage}
                  onChange={(e) => change({ coverage: e.target.value })}
                >
                  <option value="">Any coverage</option>
                  <option value="FULL_FRAME">Full-frame</option>
                  <option value="APS_C">APS-C</option>
                </select>
                <small>Coverage is not a camera compatibility guarantee.</small>
              </fieldset>
              <fieldset>
                <legend>Show me</legend>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={filters.inStockOnly}
                    onChange={(e) => change({ inStockOnly: e.target.checked, ...(e.target.checked ? {includeSoldOut:false} : {}) })}
                  />
                  Listed in stock
                </label>
                <label className="check-label">
                  <input type="checkbox" checked={filters.includeSoldOut} onChange={e => change({includeSoldOut:e.target.checked, ...(e.target.checked ? {inStockOnly:false} : {})})} />
                  Show sold-out listings
                </label>
                <small>Sold-out listings are hidden by default. Stock-unknown offers stay labelled.</small>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={filters.freshOnly}
                    onChange={(e) => change({ freshOnly: e.target.checked })}
                  />
                  Checked in the last 24h
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={filters.disclosedClearOnly}
                    onChange={(e) =>
                      change({ disclosedClearOnly: e.target.checked })
                    }
                  />
                  Seller-reported clear optics
                </label>
                <small>
                  Clear optics requires explicit “absent” disclosures for
                  fungus, haze and scratches.
                </small>
              </fieldset>
              <div className="filter-note">
                <Icon name="info" />
                <strong>Unknown stays unknown.</strong>
                <p>
                  We never turn a missing detail into a clean bill of health.
                </p>
              </div>
            </aside>
            <div className="results">
              <div className="results-heading">
                <p aria-live="polite">
                  {error ? (
                    "Listings unavailable"
                  ) : loading ? (
                    "Finding your lenses…"
                  ) : (
                    <>
                      <strong>{total}</strong>{" "}
                      {total === 1 ? "listing" : "listings"}
                      {view === "saved"
                        ? " in your filtered shortlist"
                        : demo
                          ? " in this sample collection"
                          : ""}
                    </>
                  )}
                </p>
                <label>
                  Sort by{" "}
                  <select
                    aria-label="Sort listings"
                    value={filters.sort}
                    onChange={(e) => change({ sort: e.target.value })}
                  >
                    <option value="price">
                      Price: low to high
                    </option>
                    <option value="price-desc">Price: high to low</option>
                    <option value="recent">Recently observed</option>
                  </select>
                </label>
              </div>
              {activeCount > 0 && (
                <div className="active-filters">
                  <span>
                    {activeCount} filter{activeCount === 1 ? "" : "s"} applied
                  </span>
                  <button onClick={reset}>
                    Clear all <Icon name="close" />
                  </button>
                </div>
              )}
              {error ? (
                <div className="empty-state" role="alert">
                  <Icon name="refresh" />
                  <h3>The catalogue couldn’t load.</h3>
                  <p>{error}</p>
                  <button
                    className="primary"
                    onClick={() => setReload(reload + 1)}
                  >
                    Try again
                  </button>
                </div>
              ) : loading ? (
                <div className="offer-grid" aria-label="Loading listings">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton" />
                  ))}
                </div>
              ) : offers.length === 0 ? (
                <div className="empty-state">
                  <Icon name={view === "saved" ? "bookmark" : "search"} />
                  <h3>
                    {view === "saved" && !saved.length
                      ? "Keep a few possibilities."
                      : "No lenses in this frame."}
                  </h3>
                  <p>
                    {view === "saved" && !saved.length
                      ? "Tap the bookmark on a listing to save it here. No account needed."
                      : "Try a wider budget or fewer filters. To see reference prices, enable “Show sold-out listings”."}
                  </p>
                  <button
                    className="primary"
                    onClick={() => {
                      reset();
                      if (view === "saved" && !saved.length) setView("all");
                    }}
                  >
                    {view === "saved" && !saved.length
                      ? "Explore lenses"
                      : "Reset filters"}
                  </button>
                </div>
              ) : (
                <div className="offer-grid">
                  {offers.map((o) => (
                    <OfferCard
                      key={o.id}
                      offer={o}
                      saved={saved.includes(o.id)}
                      selected={selected.includes(o.id)}
                      full={selected.length >= 3}
                      onSave={() => toggleSave(o.id)}
                      onCompare={() => toggleCompare(o.id)}
                      onDetails={() => openDetails(o.id)}
                    />
                  ))}
                </div>
              )}
              {total > 12 && (
                <div className="pagination">
                  <button
                    className="secondary"
                    disabled={!page}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page + 1} of {Math.ceil(total / 12)}
                  </span>
                  <button
                    className="secondary"
                    disabled={(page + 1) * 12 >= total}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
              <p className="results-disclaimer">
                <Icon name="info" />
                {demo
                  ? "All prices, dealers, grades and histories are illustrative. No live seller feeds are connected."
                  : "Prices and stock can change. Confirm the listing and terms with the seller before buying."}
              </p>
            </div>
          </div>
        </section>
        <div className="guide-strip shell">
          <Icon name="info" />
          <p>New to buying used? Know which details to compare.</p>
          <button className="text-arrow" onClick={() => setModal("guide")}>
            Read the short guide <Icon name="arrow" />
          </button>
        </div>
        {!staticPages && <section className="feedback shell">
          <div>
            <Icon name="heart" />
            <div>
              <h3>Help this little project find its focus.</h3>
              <p>No signup. No email. Just an anonymous vote.</p>
            </div>
          </div>
          {feedback ? (
            <p className="feedback-thanks" role="status">
              <Icon name="check" />
              Thanks — your feedback was recorded.
            </p>
          ) : (
            <div className="feedback-buttons">
              <button
                disabled={feedbackBusy}
                onClick={() => sendFeedback("helpful")}
              >
                This is useful
              </button>
              <button
                disabled={feedbackBusy}
                onClick={() => sendFeedback("missing_data")}
              >
                I need more details
              </button>
              <button
                disabled={feedbackBusy}
                onClick={() => sendFeedback("confusing")}
              >
                Something is confusing
              </button>
            </div>
          )}
          {feedbackError && (
            <p role="alert" className="error-text">
              {feedbackError}
            </p>
          )}
        </section>}
      </main>
      <footer className="shell">
        <a href="./" className="footer-logo">
          <Aperture />
          SecondGlass
        </a>
        <p>A second life for good glass.</p>
        <div>
          <button onClick={() => setModal("about")}>About the pilot</button>
          <button onClick={() => setModal("privacy")}>Privacy & usage</button>
          <span>Made for the curious.</span>
        </div>
      </footer>
      {status && (
        <div className="toast" role="status">
          {status}
        </div>
      )}
      {selected.length > 0 && (
        <div className="compare-dock">
          <div className="dock-icon">
            <Icon name="compare" />
          </div>
          <div>
            <strong>{selected.length} of 3 selected</strong>
            <span>See what the price doesn’t tell you.</span>
          </div>
          <button className="dock-clear" onClick={() => setSelected([])}>
            Clear
          </button>
          <button
            className="primary"
            disabled={selected.length < 2}
            onClick={() => openCompare()}
          >
            Compare lenses <Icon name="arrow" />
          </button>
        </div>
      )}
      {modal === "compare" && (
        <Modal title="The whole picture, side by side." onClose={close} wide>
          {modalError ? (
            <div role="alert">
              <p>{modalError}</p>
              <button className="secondary" onClick={() => openCompare()}>
                Retry
              </button>
            </div>
          ) : !comparison ? (
            <p>Loading the latest listing observations…</p>
          ) : (
            <>
              <Comparison data={comparison} />
              <div className="modal-footer">
                <p className="fine-print">
                  {comparison.offers.some((o) => o.demo)
                    ? "Includes illustrative demo listings. "
                    : ""}
                  Listed terms can change.
                </p>
                <button className="secondary" onClick={copyLink}>
                  Copy comparison link <Icon name="external" />
                </button>
              </div>
              {copyStatus && (
                <p role="status" className="copy-status">
                  {copyStatus}
                </p>
              )}
            </>
          )}
        </Modal>
      )}
      {modal === "details" && (
        <Modal title={detail?.model || "Listing details"} onClose={close}>
          {modalError ? (
            <p role="alert">{modalError}</p>
          ) : !detail ? (
            <p>Loading the latest listing observation…</p>
          ) : (
            <>
              <div className="detail-hero">
                <div>
                  <p className="eyebrow">{detail.seller}</p>
                  <strong>{money(detail.price_paise)}</strong>
                  <p>
                    {detail.mount || "Mount undisclosed"} ·{" "}
                    {coverage(detail.coverage)}
                  </p>
                  <span className={`optics-pill ${quality(detail).tone}`}>
                    {quality(detail).label}
                  </span>
                </div>
              </div>
              {detail.demo && (
                <p className="notice">
                  Sample listing from a fictional dealer. Price, condition and
                  history are illustrative.
                </p>
              )}
              {detail.stale && (
                <p className="notice">
                  This observation is older than 24 hours. Current availability
                  and price need to be checked.
                </p>
              )}
              <ProductRating offer={detail} />
              <p className="fine-print">Product reviews reported by this store, possibly across variants. This is not a rating of the retailer or the condition of a used copy. Scores are not combined across stores.</p>
              <h3>Source listing summary</h3>
              <p className="source-summary">{detail.condition_notes}</p>
              <p className="fine-print">
                Seller statement, not an independent inspection. Condition
                grades are not standardized across dealers.
              </p>
              <dl>
                <dt>Model code</dt>
                <dd>
                  {detail.model_code ||
                    "Not disclosed — exact variant unconfirmed"}
                </dd>
                <dt>Fungus</dt>
                <dd>{optical(detail.fungus)}</dd>
                <dt>Optical scratches</dt>
                <dd>{optical(detail.scratches)}</dd>
                <dt>Haze</dt>
                <dd>{optical(detail.haze)}</dd>
                <dt>Included accessories</dt>
                <dd>{detail.accessories || "Not disclosed"}</dd>
                <dt>Seller warranty</dt>
                <dd>
                  {disclosed(detail.warranty_months, " months")}
                  <small>
                    {detail.warranty_details || "Scope not disclosed"}
                  </small>
                </dd>
                <dt>Return window</dt>
                <dd>{disclosed(detail.return_days, " days")}</dd>
                <dt>Shipping</dt>
                <dd>{money(detail.shipping_paise)}</dd>
                <dt>Price + shipping</dt>
                <dd>
                  {detail.shipping_paise == null
                    ? "Total unknown"
                    : money(detail.price_paise + detail.shipping_paise)}
                </dd>
                <dt>Availability</dt>
                <dd>
                  {detail.availability.replaceAll("_", " ").toLowerCase()}
                </dd>
                <dt>Observed</dt>
                <dd>{new Date(detail.observed_at).toLocaleString("en-IN")}</dd>
              </dl>
              <h3>Price observations</h3>
              {history && <PriceHistory history={history} />}
              <div className="modal-footer">
                <button
                  className="secondary"
                  onClick={() => toggleSave(detail.id)}
                >
                  <Icon name="bookmark" />
                  {saved.includes(detail.id)
                    ? "Remove from shortlist"
                    : "Save listing"}
                </button>
                {!detail.demo && detail.source_url ? (
                  <a
                    className="primary"
                    href={detail.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit seller{" "}
                    <Icon name="external" />
                  </a>
                ) : (
                  <span className="fine-print">
                    No purchase link for sample listings.
                  </span>
                )}
              </div>
            </>
          )}
        </Modal>
      )}
      {modal === "sources" && (
        <Modal title="Stores & coverage" onClose={close}>
          <p>Comparison offers link to retail product pages with checkout. Official information sites and coverage gaps are listed separately below. Inclusion is not a guarantee of seller quality or brand authorization.</p>
          <p>{sourceInfo?.message || "Loading source coverage…"}</p>
          <div className="source-list">
            {sourceInfo?.sources?.map((s) => (
              <article key={s.id}>
                <div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    <strong>{s.name}</strong> <Icon name="external" />
                  </a>
                  <span>
                    {s.offers} offers ·{" "}
                    {s.status === "OK"
                      ? "Checked"
                      : s.status === "RETAINED"
                        ? "Refresh failed — older data"
                        : "Unavailable"}
                  </span>
                </div>
                <p>{s.storeType ? s.storeType + " · " : ""}{s.scope}</p>
                <small>
                  {s.lastSuccessAt
                    ? `Last successful read: ${new Date(s.lastSuccessAt).toLocaleString()}`
                    : "No successful read yet"}
                </small>
              </article>
            ))}
          </div>
          <h3>Official sites & coverage gaps</h3>
          <p>Reference links reviewed on 1 November 2026. These are not hourly price sources or purchase offers.</p>
          <div className="source-list">
            {officialSites.map((site) => (
              <article key={site.name}>
                <div><a href={site.url} target="_blank" rel="noopener noreferrer"><strong>{site.name}</strong> <Icon name="external" /></a></div>
                <p>{site.label}</p><small>{site.note}</small>
              </article>
            ))}
          </div>
          <p>
            Stock, shipping, warranty and the final price must be confirmed on
            the seller site. We do not process purchases or claim to cover every
            Indian reseller.
          </p>
        </Modal>
      )}
      {modal === "about" && (
        <Modal title="Good glass. A clearer comparison." onClose={close}>
          <p>
            SecondGlass compares new, used and refurbished lenses from Indian
            retailers and platforms with checkout. The pilot covers selected Sony, Canon, Nikon, Fujifilm, Sigma and Tamron lenses.
          </p>
          <h3>What works today</h3>
          <p>
            Search, filters, a local shortlist, side-by-side comparison and
            {staticPages ? "dated price observations. Historical records, anonymous feedback and optional AI require the server version." : "individual-listing price history."} Missing information stays missing.
            Exact variant comparisons require a model code and disclosed optical
            specifications.
          </p>
          <h3>{demo ? "Sample mode" : "Where prices come from"}</h3>
          <p>
            {demo
              ? "This explicit demo mode uses fictional offers."
              : "Prices and availability are observations from public seller pages. Coverage is a selected catalogue across six lens brands, not every product on every store. Use Stores & coverage to see which sources were checked."}
          </p>
          <h3>Retail purchases only</h3>
          <p>No Facebook, OLX, Quikr, community classifieds, rental listings or enquiry-only dealer catalogues. Each offer links to a retail product page. Sold-out variants are hidden by default; opt in to see their reference prices. Marketplace merchants can change, so check the actual seller and terms at checkout.</p>
          <h3>Before buying</h3>
          <p>
            New, used and refurbished variants are labelled separately. Amazon
            observations are displayed listing prices before conditional
            coupons; the actual seller and checkout total may change. 
            We have not independently inspected the items.
          </p>
          <button className="primary" onClick={close}>
            Explore the pilot <Icon name="arrow" />
          </button>
        </Modal>
      )}
      {modal === "guide" && (
        <Modal title="Before the lens goes in your bag." onClose={close}>
          <ol className="guide-list">
            <li>
              <strong>Start with the exact variant.</strong>
              <p>
                Check the manufacturer code, mount and sensor coverage. A
                matching name alone is not enough. Confirm compatibility for
                your camera with the manufacturer.
              </p>
            </li>
            <li>
              <strong>Read the optical disclosures.</strong>
              <p>
                Compare fungus, haze and scratches separately. “Good” is a
                seller’s grade; silence about a defect is not confirmation that
                it is absent.
              </p>
            </li>
            <li>
              <strong>Look at the complete offer.</strong>
              <p>
                Check accessories, disclosed shipping, warranty exclusions and
                return terms. An unknown shipping charge means the total cost is
                unknown.
              </p>
            </li>
            <li>
              <strong>Check the individual copy.</strong>
              <p>
                Ask the seller for current photographs and clarification of
                missing details. Confirm availability and price before arranging
                a purchase.
              </p>
            </li>
          </ol>
          <button className="primary" onClick={close}>
            Back to exploring
          </button>
        </Modal>
      )}
      {modal === "privacy" && (
        <Modal title="A shortlist without a signup." onClose={close}>
          <h3>What stays in your browser</h3>
          <p>
            Saved listing IDs and your usage preference are stored locally.
            There are no user accounts, email collection or tracking cookies.
            Search filters and shared comparisons can appear in the page URL.
          </p>
          {staticPages ? <>
            <h3>This GitHub Pages version</h3>
            <p>Search and comparison run in your browser using a published retailer snapshot. This version has no app analytics, anonymous feedback collection or AI requests. Your shortlist stays on this device.</p>
            <p>GitHub may log visitors’ IP addresses for security. <a href="https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection" target="_blank" rel="noopener noreferrer">GitHub Pages privacy information</a>.</p>
          </> : <>
          <h3>Anonymous aggregate counts</h3>
          <p>
            By default, we count page openings, listing views, comparisons and
            search-assistant uses by day. We store no user ID, search text or IP
            address in those counts. They measure events, not unique people, and
            can include repeated visits. Counts are retained for 90 days.
          </p>
          <p>
            The server briefly uses connection addresses in memory to limit
            repeated requests. Hosting providers may maintain their own request
            logs. Do Not Track and Global Privacy Control disable automatic
            usage counting in this browser.
          </p>
          <label className="check-label privacy-toggle">
            <input
              type="checkbox"
              checked={usageEnabled}
              disabled={
                navigator.doNotTrack === "1" || !!navigator.globalPrivacyControl
              }
              onChange={toggleUsage}
            />
            Allow anonymous usage counts
          </label>
          <h3>Feedback and optional AI</h3>
          <p>
            Feedback is an explicitly submitted anonymous category count. If AI
            is configured, you must opt in before search text is sent to that
            provider. In no-key mode, search interpretation runs on this app’s
            server and makes no AI calls. Search text is not stored by this app.
          </p>
          </>}
          <button
            className="secondary"
            onClick={() => {
              setSaved([]);
              try {
                localStorage.removeItem("secondglass.saved");
                setStatus("Your local shortlist was cleared.");
              } catch {
                setStatus("Could not clear browser storage.");
              }
            }}
          >
            Clear this browser’s shortlist
          </button>
        </Modal>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
