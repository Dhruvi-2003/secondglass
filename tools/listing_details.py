"""Evidence-scoped enrichment. Missing or contradictory claims never become guarantees."""
import json
import re
from bs4 import BeautifulSoup

POLICIES = {
 'sony': 'https://shopatsc.com/policies/refund-policy',
 'justcanon': 'https://www.justcanon.in/pages/return-refund-policy',
 'fujifilm': 'https://fujifilmxindia.com/pages/shipping-returns-policy',
 'fotocentre': 'https://fotocentreindia.com/refund-and-cancellation-policy/',
 'pooja': 'https://poojaelectronics.in/refund-and-cancellation-policy/',
 'srishti': 'https://www.srishtidigilife.co.in/pages/return-replacement-policy',
}
WARRANTY_POLICIES = {'justcanon':'https://www.justcanon.in/pages/warranty-policy'}

def text(value):
 return re.sub(r'\s+', ' ', BeautifulSoup(str(value or ''), 'html.parser').get_text(' ', strip=True)).strip()

def details(row):
 return row.setdefault('listingDetails', dict(warrantyType='UNKNOWN', returnPolicy='UNKNOWN', returnDetails=None, ratingStatus='UNAVAILABLE', evidence=[]))

def evidence(row, field, claim, scope='PRODUCT', url=None):
 claim=text(claim)[:650]
 if not claim:return
 item=dict(field=field, text=claim, sourceUrl=url or row['sourceUrl'], scope=scope)
 entries=details(row)['evidence']
 if item not in entries and len(entries)<20:entries.append(item)

def duration(claim):
 values=set()
 for n,unit in re.findall(r'\b(\d{1,3})\s*[- ]?\s*(years?|months?)\b',claim,re.I):
  value=int(n)*(12 if unit.lower().startswith('year') else 1)
  if 0<value<=120:values.add(value)
 return values

def warranty(row, claims, manufacturer=False):
 claims=list(dict.fromkeys(text(c) for c in claims if text(c)))
 if not claims:return
 months=set()
 for c in claims:
  if re.search(r'\b(?:no|without) warranty\b',c,re.I):months.add(0)
  # Conditional extensions are retained verbatim, never added to base cover.
  if re.search(r'\d\s*\+\s*\d\s*years?',c,re.I):
   months.add(int(re.search(r'(\d)\s*\+',c)[1])*12)
  elif not re.search(r'additional|extend|register',c,re.I):months.update(duration(c))
  evidence(row,'warranty',c)
 d=details(row)
 if len(months)>1 or (row.get('warrantyDetails') or '').startswith('Conflicting'):
  row['warrantyMonths']=None;d['warrantyType']='CONFLICTING'
  row['warrantyDetails']='Conflicting warranty statements on the source page. Confirm applicable cover with the retailer. '+ ' / '.join(claims)[:1100]
 else:
  row['warrantyMonths']=next(iter(months)) if months else row.get('warrantyMonths')
  d['warrantyType']='MANUFACTURER' if manufacturer or any(re.search(r'manufacturer|(?:Sony|Canon|Nikon|Fujifilm|Sigma|Tamron) India',c,re.I) for c in claims) else 'SELLER' if row['listingType']!='NEW' else 'STATED'
  row['warrantyDetails']='Source states: '+' / '.join(claims)[:1300]

def product_widgets(row,soup):
 # Judge.me global store medals deliberately excluded; only product widgets.
 candidates=[];zero=False
 for n in soup.select('.jdgm-preview-badge[data-template="product"] .jdgm-prev-badge, #judgeme_product_reviews .jdgm-rev-widg'):
  count=n.get('data-number-of-reviews','')
  if count=='0':zero=True
  elif re.fullmatch(r'\d+',count):candidates.append((n.get('data-average-rating'),count,'reviews'))
 for n in soup.select('.summary .woocommerce-product-rating .star-rating'):
  value=n.select_one('.rating');count=soup.select_one('.summary .woocommerce-review-link .count')
  if value and count:candidates.append((value.get_text(strip=True),count.get_text(strip=True),'reviews'))
 from refresh_sources import parse_rating
 ratings=[r for value,count,kind in candidates if (r:=parse_rating({'ratingValue':value,'reviewCount':count}))]
 if not row.get('productRating') and ratings and all(r==ratings[0] for r in ratings):row['productRating']=ratings[0]
 if row.get('productRating'):
  r=row['productRating'];details(row)['ratingStatus']='AVAILABLE'
  evidence(row,'rating',f"{r['value']}/5 from {r['count']} product {r['countType']}",'PRODUCT_FAMILY')
 elif zero or soup.select_one('[data-hook="es-zero-reviews-title"]') or soup.select_one('#reviews .woocommerce-noreviews'):
  details(row)['ratingStatus']='NO_REVIEWS';evidence(row,'rating','Store reports no product reviews.','PRODUCT_FAMILY')

def specifications(row,soup):
 pairs=[];sid=row['retailerId']
 if sid in {'fotocentre','pooja'}:
  for tr in soup.select('#tab-description tr'):
   cells=tr.select('th,td')
   if len(cells)==2:pairs.append(tuple(n.get_text(' ',strip=True) for n in cells))
  for heading in soup.select('#tab-description h2,#tab-description h3,#tab-description h4'):
   if heading.get_text(' ',strip=True).lower()=='in the box':
    items=heading.find_next_sibling('ul')
    if items:pairs.append(('In the box','; '.join(n.get_text(' ',strip=True) for n in items.select('li'))))
 if sid=='fujifilm':
  for li in soup.select('.specification .specs_points li'):
   label=li.select_one('b')
   if label:pairs.append((label.get_text(' ',strip=True),li.get_text(' ',strip=True)[len(label.get_text(' ',strip=True)):].strip(' -:')))
  if any(n.get_text(' ',strip=True).lower()=='free shipping' for n in soup.select('.feature-item__text')):
   row['shippingPaise']=0;evidence(row,'shipping','Free shipping advertised on this product page; confirm delivery eligibility at checkout.')
 if sid=='srishti':
  for node in soup.select('.metafield-multi_line_text_field'):
   value=node.get_text(' ',strip=True)
   match=re.search(r"What['’]s In The Box[- :]*(.{1,400}?)(?=\s*[•]?\s*MINIMUM APERTURE)",value,re.I)
   if match:pairs.append(('In the box',match[1].strip(' •\"')))
 if sid=='sigmaindia':
  for li in soup.select('.c__speclist li.l__panel__grid'):
   cells=li.select('.panel__grid')
   if len(cells)==2:pairs.append(tuple(n.get_text(' ',strip=True) for n in cells))
 if sid=='flipkart':
  for node in soup.find_all(string=re.compile(r'^\s*(?:Warranty Summary|Sales Package|Image Stabilization|Focus Type)\s*$')):
   sibling=node.parent.find_next_sibling()
   if sibling:pairs.append((str(node).strip(),sibling.get_text(' ',strip=True)))
 for label,value in pairs:
  label=label.lower()
  if label in {'in the box','supplied accessories','sales package'} and value:
   row['accessories']=value[:500];evidence(row,'accessories',value,'PRODUCT_FAMILY' if row['listingType']=='NEW' else 'PRODUCT')
  elif label in {'focus type','autofocus'} and value.lower() in {'autofocus','yes','manual focus','no'}:
   row['autofocus']=value.lower() in {'autofocus','yes'};evidence(row,'autofocus',value,'PRODUCT_FAMILY')
  elif label in {'image stabilization','image stabilisation','optical stabilization'} and value.lower() in {'yes','no'}:
   row['stabilized']=value.lower()=='yes';evidence(row,'stabilized',value,'PRODUCT_FAMILY')
  elif label=='warranty summary':warranty(row,[value])

def enrich(row,soup,product=None,offer=None,parent=None):
 product=product or {};offer=offer or {};d=details(row)
 description=text(product.get('description'))
 claims=[];sid=row['retailerId']
 # Keep only explicit warranty clauses, not arbitrary numbers elsewhere in specs.
 for clause in re.split(r'[\n.;]|(?=Warranty\s*:)',description,flags=re.I):
  if re.search(r'warranty',clause,re.I):claims.append(clause)
 selectors={
  'sony':'.warranty-box',
  'fotocentre':'.summary .woocommerce-product-details__short-description li',
  'fujifilm':'.feature-item__text, .warranty-tooltip',
  'srishti':'.metafield-multi_line_text_field',
 }
 for n in soup.select(selectors.get(sid,'.__no_details_selector')):
  value=n.get_text(' ',strip=True)
  if sid=='srishti':
   claims.extend(re.findall(r'[^.!?]*includes[^.!?]*warranty\.',value,re.I))
  elif re.search(r'warranty',value,re.I):claims.append(value)
 # Foto Centre has conflicting warranty copy in the product description too.
 if sid=='fotocentre':
  for n in soup.select('#tab-description p'):
   value=n.get_text(' ',strip=True)
   if re.search(r'\d+[- ]year warranty',value,re.I):claims.append(value)
 if sid=='cashify':
  # Existing adapter explicitly detects conflicting group/title warranty claims.
  if row.get('warrantyDetails'):claims.append(row['warrantyDetails'])
 warranty(row,claims,manufacturer=sid in {'sony','fujifilm'})
 specifications(row,soup)
 # Structured product properties describe this product, unlike site-wide charts.
 props=product.get('additionalProperty') or []
 if isinstance(props,dict):props=[props]
 for prop in props:
  label=text(prop.get('name') or prop.get('propertyID')).lower();value=text(prop.get('value'))
  if not value:continue
  if label in {'autofocus','auto focus','focus type'} and re.fullmatch(r'yes|true|autofocus|auto focus|manual focus|no|false',value,re.I):
   row['autofocus']=value.lower() in {'yes','true','autofocus','auto focus'};evidence(row,'autofocus',label+': '+value)
  if label in {'image stabilization','image stabilisation','optical stabilization','lens stabilization'} and value.lower() in {'yes','no','true','false'}:
   row['stabilized']=value.lower() in {'yes','true'};evidence(row,'stabilized',label+': '+value)
  if label in {'included accessories','in the box','supplied accessories'}:
   row['accessories']=value[:500];evidence(row,'accessories',value)
  if label in {'warranty','manufacturer warranty','seller warranty'}:warranty(row,[value],manufacturer=label=='manufacturer warranty')
 # Item condition must be seller-authored, product-scoped, and explicitly optical.
 # Never read customer reviews, grade charts, QC promises, or body scratches.
 if row['listingType']!='NEW' and not parent:
  clauses=re.split(r'[.;\n]',description)
  for field,term in [('fungus','fungus'),('haze','haze'),('scratches','scratches')]:
   found=[]
   for clause in clauses:
    if not re.search(r'\b(?:glass|optics|optical|elements?)\b',clause,re.I):continue
    if re.search(r'\b(?:if|may|might|possible|check|inspect|test|ensure|should)\b',clause,re.I):continue
    state=None
    if re.search(r'\b(?:no|without|free of)\s+(?:(?:visible|optical)\s+)?(?:(?:fungus|haze|scratches|dust)\s*(?:,|or|and)\s*)*'+term+r'\b|\b'+term+r'[- ]free\b',clause,re.I):state='ABSENT'
    elif re.search(r'\b'+term+r'\s*(?:is|are|:)?\s*(?:present|visible|observed)\b',clause,re.I):state='PRESENT'
    if state:
     found.append(state);evidence(row,field,clause)
   if found:row[field]=found[0] if len(set(found))==1 else 'UNKNOWN'
 # Offer return policy outranks stale marketing/SEO descriptions.
 policy=offer.get('hasMerchantReturnPolicy') or product.get('hasMerchantReturnPolicy')
 if isinstance(policy,dict):
  category=str(policy.get('returnPolicyCategory','')).split('/')[-1]
  claim=text(policy.get('description'));days=policy.get('merchantReturnDays')
  if category=='MerchantReturnNotPermitted':
   d['returnPolicy']='REPLACEMENT_ONLY' if re.search(r'replacement[- ]only',claim,re.I) else 'NO_RETURNS'
  elif category=='MerchantReturnFiniteReturnWindow':d['returnPolicy']='CONDITIONAL'
  if isinstance(days,int) and 0<days<=365 and d['returnPolicy']=='CONDITIONAL':row['returnDays']=days
  # Replacement days are not a refund window.
  method=str(policy.get('returnMethod','')).split('/')[-1]
  fees=str(policy.get('returnFees','')).split('/')[-1]
  d['returnDetails']=claim or ('Product data states a conditional '+str(days)+'-day return window. ' if isinstance(days,int) else 'Source return category: '+category+'. ')
  if method:d['returnDetails']+=' Return method: '+method+'.'
  if fees:d['returnDetails']+=' Return fees: '+fees+'.'
  d['returnDetails']+=' Confirm eligibility and exclusions with the seller.'
  evidence(row,'returns',d['returnDetails'])
 if sid=='cashify':
  # A real page currently advertises 48 hours while its schema says 15 days.
  # This is a conflict, not a 15-day refund entitlement.
  refund_claims=[]
  context=parent or product
  for source in [context.get('disambiguatingDescription',''),context.get('description','')]:
   refund_claims.extend(re.findall(r'\b\d+[- ](?:days?|hours?)\s+refund\b',text(source),re.I))
  for node in soup.find_all(string=re.compile(r'^\s*\d+\s+Hours?\s+Refund\*?\s*$',re.I)):
   refund_claims.append(str(node).strip())
  for node in soup.find_all(string=re.compile(r'^\s*(?:Hours? Refund\*?|Refund\*)\s*$',re.I)):
   value=node.parent.parent.get_text(' ',strip=True)
   if re.fullmatch(r'\d+\s+Hours?\s+Refund\*?',value,re.I):refund_claims.append(value)
  periods=set()
  for c in refund_claims:
   m=re.search(r'(\d+)[- ](days?|hours?)',c,re.I)
   if m:periods.add(int(m[1])*(24 if m[2].lower().startswith('day') else 1))
  if len(periods)>1:
   d['returnPolicy']='CONFLICTING';row['returnDays']=None
   d['returnDetails']='Conflicting refund windows on the product page: '+', '.join(dict.fromkeys(refund_claims))+'. Confirm the applicable policy with Cashify.'
   for claim in dict.fromkeys(refund_claims):evidence(row,'returns',claim,'PRODUCT_FAMILY')
 # Shipping figures are advertised rates, not a pincode-specific delivery quote.
 shipping=offer.get('shippingDetails') or []
 if isinstance(shipping,dict):shipping=[shipping]
 rates=[]
 for entry in shipping:
  destinations=entry.get('shippingDestination',[])
  if isinstance(destinations,dict):destinations=[destinations]
  rate=entry.get('shippingRate') or {}
  if not destinations or not all(x.get('addressCountry')=='IN' and not any(x.get(k) for k in ['addressRegion','postalCode']) for x in destinations):continue
  if rate.get('currency')=='INR':
   try:
    from decimal import Decimal
    value=Decimal(str(rate['value']))*100
    if value.is_finite() and value==int(value) and 0<=value<=1000000:rates.append(int(value))
   except (ValueError,KeyError,ArithmeticError):pass
 if rates and len(set(rates))==1:
  row['shippingPaise']=rates[0];evidence(row,'shipping',f"Advertised India shipping: INR {rates[0]/100:g}; confirm delivery eligibility at checkout.")
 # A ProductGroup aggregate belongs to the same lens family, not the shop.
 if not row.get('productRating') and parent:
  from refresh_sources import parse_rating
  rating=parse_rating(parent.get('aggregateRating'))
  if rating:row['productRating']=rating
 product_widgets(row,soup)
 return row

def enrich_policy(row,html,url):
 """Store policy evidence. Do not convert cancellation/refund-processing times to return windows."""
 soup=BeautifulSoup(html,'html.parser')
 for n in soup(['script','style','nav','header','footer','noscript']):n.decompose()
 node=soup.select_one('.shopify-policy__body') or soup.select_one('main') or soup.select_one('.entry-content')
 if node is None:return
 value=node.get_text(' ',strip=True)
 sid=row['retailerId'];summary=None
 # These guards identify the reviewed policy section. Layout/copy changes fail closed.
 if sid in {'fotocentre','pooja'} and re.search(r'Open cameras, Lens and related peripherals',value,re.I):
  summary='Store policy: opened cameras/lenses and special-order or backordered items are excluded from refund/exchange. Returns require original packaging, inspection and approval. Damage or missing items must be reported within 24 hours. Confirm eligibility before opening the lens.'
 elif sid=='justcanon' and 'there is no refund or exchange possible' in value:
  summary='Store policy: no refund/exchange for correctly delivered, accepted orders. Contact customer service for damaged or incorrect items; receipt and return authorisation required. Return postage is not refunded.'
 elif sid=='srishti' and 'All Sales Are Final' in value and 'within 24 hours' in value:
  summary='Store policy: all sales final. Report damaged, defective or incorrectly shipped items within 24 hours. Refund/replacement is subject to retailer investigation and approval. The stated 7-day refund-processing time is not a return window.'
 elif sid=='fujifilm' and 'Products purchased at fujifilmxshop cannot be refunded or exchanged' in value:
  summary='Store policy: purchases cannot be refunded or exchanged. Contact customer service for a defective new product. Cancellation has separate time limits and payment-method exclusions.'
 elif sid=='sony' and 'cancelation request' in value and 'payment gateway charges' in value:
  summary='This linked page describes cancellation refunds, with payment-gateway deductions and 7–10 working days processing. It does not establish a post-delivery lens return window.'
 if not summary:return False
 d=details(row)
 if d['returnPolicy']=='UNKNOWN':
  d['returnPolicy']='CANCELLATION_ONLY' if sid=='sony' else 'RESTRICTED'
  d['returnDetails']=summary
 evidence(row,'returns',summary,'STORE_POLICY',url)
 return True

def enrich_warranty_policy(row,html,url):
 soup=BeautifulSoup(html,'html.parser')
 for n in soup(['script','style','nav','header','footer']):n.decompose()
 node=soup.select_one('main')
 value=node.get_text(' ',strip=True) if node else ''
 if row['retailerId']=='justcanon' and 'Canon Camera India offers a manufacturer' in value and 'ends latest two years' in value:
  # "Ends latest two years" describes a maximum, not an unconditional duration.
  claim='Store warranty policy states Canon manufacturer cover from authorised-dealer purchase, ending no later than two years. Manufacturing/material defects are covered; exclusions and proof-of-purchase requirements apply. Confirm this lens’s exact duration.'
  d=details(row)
  if d['warrantyType']=='UNKNOWN':
   d['warrantyType']='MANUFACTURER';row['warrantyDetails']=claim
  evidence(row,'warranty',claim,'STORE_POLICY',url)
  return True
 return False
