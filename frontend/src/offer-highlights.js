import {warrantyLabel, returnsLabel} from './lib.js';

// Unknown fields belong in details. Adverse disclosures always outrank benefits.
export function offerHighlights(o) {
  const warnings=[], known=[];
  const d=o.listing_details || {};
  const add=(list,key,label,tone='known')=>list.push({key,label,tone});
  if([o.fungus,o.haze,o.scratches].includes('PRESENT')) add(warnings,'optics','Optical issue reported','alert');
  else if(o.listing_type!=='NEW' && [o.fungus,o.haze,o.scratches].every(v=>v==='ABSENT')) add(known,'optics','Seller reports clear optics');
  if(d.warrantyType==='CONFLICTING' || /^Conflicting/i.test(o.warranty_details || '')) add(warnings,'warranty', 'Warranty claims conflict','alert');
  else if(o.warranty_months===0) add(warnings,'warranty','No warranty stated','caution');
  else if(o.warranty_months!=null || o.warranty_details) known.unshift({key:'warranty',label:warrantyLabel(o).replace(' · see details',''),tone:'known'});
  if(d.returnPolicy==='CONFLICTING') add(warnings,'returns','Return terms conflict','alert');
  else if(['NO_RETURNS','REPLACEMENT_ONLY','RESTRICTED'].includes(d.returnPolicy)) add(warnings,'returns',returnsLabel(o).replace(/ · see (?:terms|policy)/,''),'caution');
  else if(o.return_days!=null) add(known,'returns',returnsLabel(o).replace(' · see terms',''));
  else if(d.returnPolicy==='CONDITIONAL') add(known,'returns','Conditional returns');
  if(o.shipping_paise===0) add(known,'shipping','Free shipping advertised');
  return [...warnings,...known.slice(0,Math.max(0,2-warnings.length))];
}

export function groupAlerts(offers) {
  const labels={optics:'optical issues reported',warranty:'conflicting warranty claims',returns:'conflicting return terms'};
  return Object.entries(labels).flatMap(([key,label])=>{
    const count=offers.filter(o=>offerHighlights(o).some(h=>h.key===key && h.tone==='alert')).length;
    return count ? [{key,label:`${count} ${count===1 ? 'offer has' : 'offers have'} ${label}`}]:[];
  });
}
