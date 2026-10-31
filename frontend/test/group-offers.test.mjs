import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareSnapshot} from '../prepare-pages.mjs';
import {createSnapshotApi} from '../src/pages-api.mjs';
import {groupOffers} from '../src/group-offers.mjs';
const raw=JSON.parse(await readFile(new URL('./fixtures/catalogue-2026-10-31.json',import.meta.url)));
const snapshot=prepareSnapshot(raw), api=createSnapshotApi(snapshot,()=>Date.parse(raw.generatedAt));
const exact=snapshot.offers.find(o=>o.complete);
const offer=(id,extra={})=>({...exact,id,retailer_id:id,seller:'Store '+id,price_paise:2000000,availability:'IN_STOCK',...extra});

test('a lens is grouped across all filtered offers before pagination',()=>{
 const all=api('/api/catalog?grouped=true&includeSoldOut=true&size=48');
 assert.ok(all.total<all.totalOffers);
 assert.equal(all.totalOffers,snapshot.offers.length);
 const group=all.groups.find(g=>g.offers.length>1);
 const expected=snapshot.offers.filter(o=>o.complete && o.configuration_id===group.offers[0].configuration_id);
 assert.deepEqual(new Set(group.offers.map(o=>o.id)),new Set(expected.map(o=>o.id)));
 const pages=Array.from({length:all.total},(_,page)=>api('/api/catalog?grouped=true&includeSoldOut=true&size=1&page='+page));
 assert.equal(new Set(pages.flatMap(p=>p.offers.map(o=>o.id))).size,snapshot.offers.length);
 assert.equal(pages.flatMap(p=>p.offers).length,snapshot.offers.length);
 assert.ok(pages.every(p=>p.groups.length===1));
 assert.equal(pages.find(p=>p.groups[0].id===group.id).offers.length,expected.length);
});
test('different mount, model, coverage, focus and stabilisation never merge',()=>{
 for(const [field,value] of [['mount','Nikon Z'],['model_code','DIFFERENT'],['coverage','APS_C'],['autofocus',false],['stabilized',!exact.stabilized]]) {
  const groups=groupOffers([offer('a'),offer('b',{[field]:value})]);
  assert.equal(groups.length,2,field);
 }
});
test('unknown identity remains separate even when titles or configuration IDs agree',()=>{
 assert.equal(groupOffers([offer('a',{complete:false}),offer('b',{complete:false})]).length,2);
 assert.equal(groupOffers([offer('a',{model_code:null}),offer('b',{model_code:null})]).length,2);
 assert.equal(groupOffers([offer('a',{model_code:''}),offer('b',{model_code:''})]).length,2);
});
test('store count is unique and a cheaper sold-out variant cannot anchor the price',()=>{
 const [g]=groupOffers([offer('a',{price_paise:1000000,availability:'OUT_OF_STOCK'}),offer('b',{price_paise:2000000,retailer_id:'same'}),offer('c',{price_paise:2100000,retailer_id:'same',listing_type:'USED'})]);
 assert.equal(g.storeCount,2);assert.equal(g.inStockStoreCount,1);
 assert.equal(g.fromPrice,2000000);assert.equal(g.offers.at(-1).id,'a');
 assert.equal(g.offers[1].listing_type,'USED');
});
test('sorting uses the lowest eligible group price rather than its highest offer',()=>{
 const rows=[offer('a',{price_paise:1000000}),offer('b',{price_paise:9000000}),offer('c',{price_paise:2000000,configuration_id:'different'})];
 assert.deepEqual(groupOffers(rows,'price-desc').map(g=>g.fromPrice),[2000000,1000000]);
 const old=offer('old',{observed_at:'2026-10-29T10:00:00Z'}), recent=offer('new',{configuration_id:'new',observed_at:'2026-10-30T10:00:00Z'});
 assert.equal(groupOffers([old,recent],'recent')[0].offers[0].id,'new');
});
test('store, condition, budget, stock and saved filters apply before grouping',()=>{
 const rows=[offer('a',{listing_type:'NEW'}),offer('b',{listing_type:'USED',price_paise:1000000}),offer('c',{listing_type:'NEW',price_paise:500000,availability:'OUT_OF_STOCK'})];
 const request=createSnapshotApi({...snapshot,offers:rows},()=>Date.parse(raw.generatedAt));
 assert.equal(request('/api/catalog?grouped=true').groups[0].offers.length,2);
 assert.deepEqual(request('/api/catalog?grouped=true&listingType=NEW').offers.map(o=>o.id),['a']);
 assert.equal(request('/api/catalog?grouped=true&retailer=b').groups[0].storeCount,1);
 assert.deepEqual(request('/api/catalog?grouped=true&maxPrice=15000').offers.map(o=>o.id),['b']);
 assert.deepEqual(request('/api/catalog?grouped=true&ids=a,b').offers.map(o=>o.id),['b','a']);
 assert.equal(request('/api/catalog?grouped=true&retailer=missing').total,0);
 assert.equal(request('/api/compare?ids=a,b').modelMatch,'MATCHING_VARIANT');
});
