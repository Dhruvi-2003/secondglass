const identityFields = ['brand','model_code','mount','coverage','focal_min','focal_max','max_aperture','autofocus','stabilized'];
const normalized = v => String(v).trim().toLowerCase().replace(/\s+/g,' ');
const isSoldOut = o => o.availability === 'OUT_OF_STOCK';
export function offerOrder(a,b) {
  return Number(isSoldOut(a))-Number(isSoldOut(b)) || a.price_paise-b.price_paise || a.id.localeCompare(b.id);
}
export function summarizeGroup(id, offers) {
  const ordered=[...offers].sort(offerOrder);
  const active=ordered.filter(o=>!isSoldOut(o));
  const priced=active.length ? active : ordered;
  return {id, offers:ordered, storeCount:new Set(ordered.map(o=>o.retailer_id)).size,
    inStockStoreCount:new Set(ordered.filter(o=>o.availability==='IN_STOCK').map(o=>o.retailer_id)).size,
    fromPrice:Math.min(...priced.map(o=>o.price_paise)), soldOut:!active.length,
    latestObservedAt:ordered.reduce((latest,o)=>Date.parse(o.observed_at)>(Date.parse(latest)||0) ? o.observed_at : latest,'')};
}
export function groupOffers(offers, sort='price') {
  const groups=new Map();
  for(const o of offers) {
    // Complete manufacturer identity is required. Titles/grades never establish a match.
    const complete=o.complete === true && o.configuration_id && identityFields.every(k=>o[k]!=null && normalized(o[k])!=='');
    const key=complete ? `lens:${o.configuration_id}:${JSON.stringify(identityFields.map(k=>normalized(o[k])))}` : `offer:${o.id}`;
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(o);
  }
  return [...groups].map(([id,rows])=>summarizeGroup(id,rows)).sort((a,b)=>
    (sort==='recent' ? Date.parse(b.latestObservedAt)-Date.parse(a.latestObservedAt) :
      sort==='price-desc' ? b.fromPrice-a.fromPrice : Number(a.soldOut)-Number(b.soldOut) || a.fromPrice-b.fromPrice) || a.id.localeCompare(b.id));
}
