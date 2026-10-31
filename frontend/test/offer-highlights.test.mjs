import test from 'node:test';
import assert from 'node:assert/strict';
import {offerHighlights,groupAlerts} from '../src/offer-highlights.js';

test('missing details and zero-review states do not become card filler or benefits',()=>{
 const o={listing_type:'USED',fungus:'UNKNOWN',scratches:'UNKNOWN',haze:'UNKNOWN',listing_details:{ratingStatus:'NO_REVIEWS',warrantyType:'UNKNOWN',returnPolicy:'CANCELLATION_ONLY'}};
 assert.deepEqual(offerHighlights(o),[]);
 assert.deepEqual(groupAlerts([o]),[]);
});
test('known terms are limited while all adverse disclosures remain visible',()=>{
 const o={warranty_months:24,shipping_paise:0,listing_details:{warrantyType:'MANUFACTURER',returnPolicy:'CONDITIONAL'},return_days:7};
 assert.deepEqual(offerHighlights(o).map(h=>h.key),['warranty','returns']);
 const conflicts={...o,fungus:'PRESENT',listing_details:{warrantyType:'CONFLICTING',returnPolicy:'CONFLICTING'}};
 assert.deepEqual(offerHighlights(conflicts).map(h=>h.key),['optics','warranty','returns']);
 assert.ok(offerHighlights(conflicts).every(h=>h.tone==='alert'));
});
test('no warranty and restrictive returns are retained rather than presented as missing',()=>{
 const o={warranty_months:0,shipping_paise:0,listing_details:{returnPolicy:'NO_RETURNS'}};
 assert.deepEqual(offerHighlights(o).map(h=>h.label),['No warranty stated','No returns stated']);
 assert.ok(offerHighlights(o).every(h=>h.tone==='caution'));
 assert.equal(offerHighlights({listing_details:{returnPolicy:'REPLACEMENT_ONLY'}})[0].label,'Replacement only');
 assert.equal(offerHighlights({warranty_details:'Conflicting source warranty claims'})[0].tone,'alert');
});
test('only explicit clean optics get a benefit and groups count conflicting offers',()=>{
 assert.equal(offerHighlights({listing_type:'USED',fungus:'ABSENT',haze:'ABSENT',scratches:'ABSENT'})[0].label,'Seller reports clear optics');
 assert.deepEqual(offerHighlights({listing_type:'USED',fungus:'ABSENT',haze:'UNKNOWN',scratches:'ABSENT'}),[]);
 assert.deepEqual(groupAlerts([{listing_details:{warrantyType:'CONFLICTING'}},{listing_details:{warrantyType:'CONFLICTING',returnPolicy:'CONFLICTING'}},{}]).map(a=>a.label),['2 offers have conflicting warranty claims','1 offer has conflicting return terms']);
});
