import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareSnapshot} from '../prepare-pages.mjs';
import {createSnapshotApi} from '../src/pages-api.mjs';
import {initialFilters} from '../src/lib.js';
// Recorded fixture keeps model/price assertions deterministic as the live catalogue changes.
const source=JSON.parse(await readFile(new URL('./fixtures/catalogue-2026-10-31.json',import.meta.url)));
const snapshot=prepareSnapshot(source),api=createSnapshotApi(snapshot,()=>Date.parse(source.generatedAt));
test('shared mount filters survive reload and never broaden to a different mount',()=>{
 for(const mount of ['Nikon Z','Nikon F','Sony E','Sony A','Canon EF','Canon EF-S','Canon RF','Canon RF-S','Fujifilm X','Fujifilm GFX','L-Mount','Micro Four Thirds']) {
  const query='?mount='+encodeURIComponent(mount);
  assert.equal(initialFilters(query).mount,mount);
  const result=api('/api/catalog'+query+'&includeSoldOut=true&size=48');
  assert.ok(result.offers.every(o=>o.mount===mount));
  assert.equal(result.total,snapshot.offers.filter(o=>o.mount===mount).length);
 }
 assert.equal(initialFilters('?mount=unknown').mount,'');
});
test('current catalogue can be published without assuming fixed prices or counts',async()=>{
 const current=prepareSnapshot(JSON.parse(await readFile(new URL('../../catalogue/live.json',import.meta.url))));
 assert.ok(current.offers.length>0);
 for(const o of current.offers) {
  assert.ok(Number.isSafeInteger(o.price_paise)&&o.price_paise>=10000&&o.price_paise<=100_000_000);
  assert.ok(Number.isFinite(Date.parse(o.observed_at)));
  assert.ok(['IN_STOCK','OUT_OF_STOCK','BACKORDER','UNKNOWN'].includes(o.availability));
 }
});
test('real snapshot has stable unique IDs and no internal diagnostics',()=>{
 assert.equal(snapshot.offers.length,32);assert.equal(new Set(snapshot.offers.map(o=>o.id)).size,32);
 assert.ok(snapshot.offers.every(o=>!o.demo&&o.source_url.startsWith('https://')));
 assert.ok(snapshot.sources.every(s=>!('error' in s)));
 assert.deepEqual(prepareSnapshot(source).offers.map(o=>o.id),snapshot.offers.map(o=>o.id));
});
test('sold-out opt-in and strict stock filter preserve backorders',()=>{
 assert.ok(api('/api/catalog?size=48').offers.every(o=>o.availability!=='OUT_OF_STOCK'));
 assert.equal(api('/api/catalog?size=48&includeSoldOut=true').total,32);
 const rows=api('/api/catalog?size=48&inStockOnly=true&includeSoldOut=true').offers;
 assert.ok(rows.length&&rows.every(o=>o.availability==='IN_STOCK'));
});
test('manufacturer, mount and variant price remain distinct',()=>{
 const rows=api('/api/catalog?brand=Tamron&size=48').offers;
 assert.deepEqual(new Set(rows.map(o=>o.mount)),new Set(['Sony E','Nikon Z']));
 assert.equal(api('/api/catalog?brand=Tamron&mount=Nikon+Z').offers[0].price_paise,3799000);
 assert.equal(api('/api/catalog?brand=Fujifilm').offers[0].coverage,'APS_C');
});
test('comparison rejects duplicate or missing offers and uncertain matches',()=>{
 const sony=snapshot.offers.filter(o=>o.model_code==='SEL50F18F'),tamron=snapshot.offers.filter(o=>o.brand==='Tamron');
 assert.equal(api('/api/compare?ids='+sony.slice(0,2).map(o=>o.id)).modelMatch,'MATCHING_VARIANT');
 assert.equal(api('/api/compare?ids='+tamron.map(o=>o.id)).modelMatch,'INSUFFICIENT_INFORMATION');
 assert.throws(()=>api('/api/compare?ids='+[sony[0].id,sony[0].id]));assert.throws(()=>api('/api/offers/missing'));
});
test('staleness follows observation date, never deployment time',()=>{
 const later=createSnapshotApi(snapshot,()=>Date.parse(source.generatedAt)+2*86400000);
 assert.equal(later('/api/catalog?freshOnly=true').total,0);assert.ok(later('/api/catalog').offers.every(o=>o.stale));
});
test('pagination, literal search and shortlist work',()=>{
 const first=api('/api/catalog?size=2'),next=api('/api/catalog?size=2&page=1');
 assert.equal(first.total,next.total);assert.equal(first.offers.length,2);
 assert.ok(first.offers.every(o=>!next.offers.some(n=>n.id===o.id)));
 assert.equal(api('/api/catalog?q=%25').total,0);
 const id=first.offers[0].id;assert.deepEqual(api('/api/catalog?ids='+id).offers.map(o=>o.id),[id]);
});
test('history contains only the published observation and writes are unavailable',()=>{
 const o=snapshot.offers[0],h=api('/api/offers/'+o.id+'/history');
 assert.equal(h.points.length,1);assert.equal(h.points[0].observed_at,o.observed_at);
 assert.match(h.scope,/Only the published observation/);
 assert.throws(()=>api('/api/events'));assert.throws(()=>api('/api/search/interpret'));
});
