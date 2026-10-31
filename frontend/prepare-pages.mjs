import {createHash} from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const normalize = v => v == null ? '?' : String(v).trim().toLowerCase().replace(/\s+/g,' ');
export function prepareSnapshot(snapshot) {
  if (!snapshot.observations?.length || !snapshot.sources || !snapshot.generatedAt) throw new Error('Missing real snapshot');
  const fields = ['brand','model','modelCode','mount','coverage','focalMin','focalMax','maxAperture','autofocus','stabilized','conditionLabel','conditionNotes','fungus','scratches','haze','accessories','warrantyMonths','warrantyDetails','returnDays','pricePaise','shippingPaise','availability','sourceUrl','observedAt','listingType'];
  const sourceFields = ['id','name','url','status','checkedAt','lastSuccessAt','offers','scope','message','storeType'];
  const offers = snapshot.observations.map(r => {
    if (r.demo || new URL(r.sourceUrl).protocol !== 'https:') throw new Error('Pages requires real HTTPS seller observations');
    const o = Object.fromEntries(fields.map(k => [k.replace(/[A-Z]/g,l => '_'+l.toLowerCase()),r[k] ?? null]));
    const identity = ['brand','modelCode','mount','coverage','focalMin','focalMax','maxAperture','autofocus','stabilized'];
    o.complete = identity.every(k => r[k] != null);
    o.configuration_id = hash(identity.map(k => normalize(r[k])).join('|') + (o.complete ? '' : '|'+r.retailerId+'|'+r.externalKey));
    return {...o, id:hash(r.retailerId+'|'+r.externalKey).slice(0,32), retailer_id:r.retailerId, seller:r.retailerName, demo:false,
      product_rating:r.productRating?.value ?? null, product_rating_count:r.productRating?.count ?? null, product_rating_count_type:r.productRating?.countType ?? null};
  });
  if (new Set(offers.map(o => o.id)).size !== offers.length) throw new Error('Duplicate snapshot offer IDs');
  return {generatedAt:snapshot.generatedAt, offers, sources:snapshot.sources.map(s => Object.fromEntries(sourceFields.map(k => [k,s[k] ?? null])))};
}
