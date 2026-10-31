// Read-only adapter for GitHub Pages. No remote AI, feedback sink or server API.
export function createSnapshotApi(snapshot, now = () => Date.now()) {
  const byId = new Map(snapshot.offers.map(o => [o.id, o]));
  const decorate = o => ({...o, stale: now() - Date.parse(o.observed_at) > 86400000});
  const offer = id => {
    if (!byId.has(id)) throw new Error('This listing is not in the published snapshot.');
    return decorate(byId.get(id));
  };
  return function request(path) {
    const {pathname, searchParams: p} = new URL(path, 'https://snapshot.invalid');
    if (pathname === '/api/search/capabilities') return {aiConfigured: false};
    if (pathname === '/api/sources') return {sources: snapshot.sources, generatedAt: snapshot.generatedAt,
      message: 'Published retailer snapshot. Prices are not refreshed while you browse. Check each observation date and confirm current stock with the seller.'};
    if (pathname === '/api/catalog') {
      const terms = (p.get('q') || '').toLowerCase().replaceAll('–','-').trim().split(/\s+/).filter(Boolean);
      const ids = p.get('ids') ? new Set(p.get('ids').split(',')) : null;
      let rows = snapshot.offers.filter(o => {
        const text = [o.brand,o.model,o.model_code,o.mount].join(' ').toLowerCase().replaceAll('–','-');
        return o.price_paise <= Number(p.get('maxPrice') ?? 1000000)*100 && terms.every(t => text.includes(t)) &&
          (!ids || ids.has(o.id)) &&
          ['brand','coverage','mount'].every(k => !p.get(k) || String(o[k]).toLowerCase() === p.get(k).toLowerCase()) &&
          (!p.get('retailer') || o.retailer_id === p.get('retailer')) &&
          (!p.get('listingType') || o.listing_type === p.get('listingType')) &&
          (!p.get('kind') || (o.focal_min != null && o.focal_max != null &&
            (p.get('kind') === 'prime' ? o.focal_min === o.focal_max : o.focal_min < o.focal_max))) &&
          (p.get('includeSoldOut') === 'true' || o.availability !== 'OUT_OF_STOCK') &&
          (p.get('inStockOnly') !== 'true' || o.availability === 'IN_STOCK') &&
          (p.get('freshOnly') !== 'true' || !decorate(o).stale) &&
          (p.get('disclosedClearOnly') !== 'true' || ['fungus','haze','scratches'].every(k => o[k] === 'ABSENT'));
      });
      const sort = p.get('sort') || 'price';
      rows.sort((a,b) => (sort === 'recent' ? Date.parse(b.observed_at)-Date.parse(a.observed_at) :
        sort === 'price-desc' ? b.price_paise-a.price_paise :
        Number(a.availability === 'OUT_OF_STOCK')-Number(b.availability === 'OUT_OF_STOCK') || a.price_paise-b.price_paise) || a.id.localeCompare(b.id));
      const page = Math.max(0,Number(p.get('page')) || 0), size = Math.min(48,Math.max(1,Number(p.get('size')) || 12));
      return {offers: rows.slice(page*size,(page+1)*size).map(decorate), total: rows.length, page, size, demo:false, freshHours:24};
    }
    if (pathname === '/api/compare') {
      const ids = (p.get('ids') || '').split(',');
      if (ids.length < 2 || ids.length > 3 || new Set(ids).size !== ids.length) throw new Error('Choose 2 or 3 different offers.');
      const offers = ids.map(offer), incomplete = offers.some(o => !o.complete);
      return {offers, modelMatch: incomplete ? 'INSUFFICIENT_INFORMATION' :
        new Set(offers.map(o => o.configuration_id)).size === 1 ? 'MATCHING_VARIANT' : 'DIFFERENT_VARIANTS',
        notice:'Matching models do not mean equivalent physical condition. Prices are from the published snapshot; confirm with the seller.'};
    }
    const match = pathname.match(/^\/api\/offers\/([a-zA-Z0-9-]{1,36})(\/history)?$/);
    if (match) {
      const o = offer(match[1]);
      return match[2] ? {points:[{price_paise:o.price_paise,availability:o.availability,observed_at:o.observed_at}], demo:false,
        scope:'Only the published observation is available here. Historical database records are not included in the GitHub Pages version.'} : o;
    }
    throw new Error('This feature needs the Spring Boot server and is unavailable on GitHub Pages.');
  };
}
let loaded;
export async function snapshotRequest(path, options = {}) {
  if (options.method && options.method !== 'GET') throw new Error('This static site does not collect feedback or run AI requests.');
  const catalogueUrl=new URL('catalogue.json',document.baseURI);
  if(typeof __CATALOGUE_VERSION__ !== 'undefined' && __CATALOGUE_VERSION__) catalogueUrl.searchParams.set('v',__CATALOGUE_VERSION__);
  if (!loaded) loaded = fetch(catalogueUrl)
    .then(r => { if (!r.ok) throw new Error('The catalogue snapshot could not be loaded. Please retry.'); return r.json(); })
    .then(createSnapshotApi).catch(e => { loaded = null; throw e; });
  const request = await loaded;
  options.signal?.throwIfAborted();
  return request(path);
}
