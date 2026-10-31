#!/usr/bin/env python3
"""Bounded public-page adapters. No credentials, browser impersonation or challenge bypass.
Writes a factual snapshot atomically; a failed source retains its last successful rows.
"""
import argparse
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import time
from urllib.parse import urlparse, urljoin, parse_qs
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
RETAILERS = json.loads((ROOT/'backend'/'src'/'main'/'resources'/'retailers.json').read_text())
ALLOWED = {entry['host'] for entry in RETAILERS.values()}
SOURCES = [
 ('fujifilm', 'Fujifilm X India', 'https://fujifilmxindia.com/collections/lenses', 'Selected Fujifilm X lens from the manufacturer-linked authorised online store'),
 ('fotocentre', 'Foto Centre India', 'https://fotocentreindia.com/product/sony-fe-50mm-f1-8-lens-in-mumbai-india/', 'Selected Sony, Nikon, Sigma and Tamron lenses; mount variants and backorders stay separate'),
 ('justcanon', 'Just Canon', 'https://www.justcanon.in/products/canon-rf-50mm-f-1-8-stm', 'Selected new Canon RF lens; direct retail variant checkout'),
 ('cashify', 'Cashify', 'https://www.cashify.in/buy-refurbished-camera-lens/renewed-sony-fe-2-28-mm', 'Selected refurbished Sony lens variants; stock and policy differences stay explicit'),
 ('dacby', 'Dacby', 'https://dacby.com/buy/camera-lens/canon-ef-s-55-250mm-f40-56-is-ii-telephoto-zoom-lens-mIlHbTTZRy89fBz545Su', 'Selected pre-owned Canon EF-S lens; retail checkout'),
 ('flipkart', 'Flipkart', 'https://www.flipkart.com/sony-sel50f18-bc-lens/p/itmf3xjg4jvafmwz', 'Selected new Sony E 50mm OSS listing; merchant and delivery depend on checkout'),
 ('srishti', 'Srishti Digilife', 'https://www.srishtidigilife.co.in/products/sony-fe-50mm-f-1-8-lens', 'Selected new Sony FE 50mm listing'),
 ('pooja', 'Pooja Electronics', 'https://poojaelectronics.in/product/sony-50mm-f1-8-lens-online-buy-mumbai-india/', 'Selected new Sony FE 50mm listing'),
 ('amazon', 'Amazon India', 'https://www.amazon.in/s?k=sony+50mm+f1.8+lens', 'Selected new Sony/Sigma listings; marketplace seller and checkout price may change'),
 ('rk', 'RK Deals', 'https://www.rkdeals.co.in/product-page/sony-fe-50mm-f-1-8-prime-lens-for-sony-e-mount-full-frame-cameras', 'Selected used Sony lens product pages'),
 ('cameraclub', 'Camera Club India', 'https://cameraclub.in/pages/lens', 'Selected Sony products and separately priced condition variants'),
 ('sony', 'ShopAtSC', 'https://shopatsc.com/collections/camera-lenses', 'Selected new Sony lenses; reference prices include sold-out products'),
]
PRODUCTS = {
 'fotocentre': [
  'https://fotocentreindia.com/product/sony-fe-50mm-f1-8-lens-in-mumbai-india/',
  'https://fotocentreindia.com/product/nikon-z-35mm-f-1-4-lens/',
  'https://fotocentreindia.com/product/sigma-12mm-f-1-4-dc-contemporary-lens/',
  'https://fotocentreindia.com/product/tamron-70-300mm-f-4-5-6-3-di-iii-rxd-lens-for-sony-e-india/',
 ],
 'fujifilm': ['https://fujifilmxindia.com/products/fujifilm-xc35mmf2'],
 'justcanon': ['https://www.justcanon.in/products/canon-rf-50mm-f-1-8-stm'],
 'cashify': ['https://www.cashify.in/buy-refurbished-camera-lens/renewed-sony-fe-2-28-mm'],
 'dacby': ['https://dacby.com/buy/camera-lens/canon-ef-s-55-250mm-f40-56-is-ii-telephoto-zoom-lens-mIlHbTTZRy89fBz545Su'],
 'flipkart': ['https://www.flipkart.com/sony-sel50f18-bc-lens/p/itmf3xjg4jvafmwz'],
 'srishti': ['https://www.srishtidigilife.co.in/products/sony-fe-50mm-f-1-8-lens'],
 'pooja': ['https://poojaelectronics.in/product/sony-50mm-f1-8-lens-online-buy-mumbai-india/'],
 'rk': ['https://www.rkdeals.co.in/product-page/sony-fe-50mm-f-1-8-prime-lens-for-sony-e-mount-full-frame-cameras'],
 'cameraclub': ['https://cameraclub.in/products/used-i-sony-e-mount-fe-50mm-f1-8-full-frame-lens', 'https://cameraclub.in/products/pre-owned-sony-sel24105g-fe-24-105-mm-f4-g-oss-e-mount-lens','https://cameraclub.in/products/sony-vario-tessar-t-fe-24-70mm-f4-za-oss-lens'],
 'sony': ['https://shopatsc.com/products/sel2470gm-q-syx','https://shopatsc.com/products/sel200600g-csyx','https://shopatsc.com/products/sel1625g'],
}
# Reviewed product identities, not fuzzy matching. Unknown specifications stay unknown.
AMAZON = {
 'B01DLMD5O6': ('Sony','FE 50mm F1.8','SEL50F18F','FULL_FRAME',50,50,'1.8',False),
 'B00EPWC30O': ('Sony','E 50mm F1.8 OSS','SEL50F18','APS_C',50,50,'1.8',True),
 'B09JVBB36L': ('Sigma','18–50mm F2.8 DC DN Contemporary',None,'APS_C',18,50,'2.8',None),
 'B01C3SCKI6': ('Sigma','30mm F1.4 DC DN Contemporary',None,'APS_C',30,30,'1.4',None),
 'B003OUX6MW': ('Sony','E 16mm F2.8','SEL16F28','APS_C',16,16,'2.8',None),
}
def now(): return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
def fetch(url):
 if urlparse(url).scheme != 'https' or urlparse(url).hostname not in ALLOWED: raise ValueError('Unapproved source URL')
 with urlopen(Request(url, headers={'User-Agent':'SecondGlass/0.1 (public lens comparison pilot)'}),timeout=30) as response:
  if urlparse(response.url).hostname not in ALLOWED: raise ValueError('Unexpected redirect')
  raw=response.read(8_000_001)
 if len(raw)>8_000_000: raise ValueError('Source exceeds size limit')
 return raw.decode('utf-8',errors='replace'), now()
def paise(value):
 match=re.search(r'\d[\d,]*(?:\.\d{1,2})?',str(value))
 if not match: raise ValueError('Missing INR price')
 amount=Decimal(match[0].replace(',',''))*100
 if not 10000<=amount<=100_000_000:raise ValueError('Price outside pilot bounds')
 return int(amount)
MOUNT_SLUGS = {'sony-e':'Sony E','nikon-z':'Nikon Z','fujifilm-x':'Fujifilm X',
 'canon-rf':'Canon RF','canon-ef':'Canon EF','canon-ef-s':'Canon EF-S','canon-rf-s':'Canon RF-S','l-mount':'L-Mount'}
def resolve_mount(text,url):
 # A selected retailer variant outranks the multi-mount family description.
 selected=parse_qs(urlparse(url).query).get('attribute_pa_mounts',[])
 if selected:return MOUNT_SLUGS.get(selected[0]) if len(selected)==1 else None
 matches=set()
 for pattern,mount in [(r'\bSony\s+E(?:[- ]mount)?\b|\bE[- ]mount\b|\bFE\b|\bSEL50F18(?:F|/BC)?\b','Sony E'),
                       (r'\b(?:Nikon|Nikkor)\s+Z\b','Nikon Z'),
                       (r'\bFujifilm\s+(?:X\b|X[FC]\s*\d)','Fujifilm X'),
                       (r'\bL[- ]Mount\b','L-Mount')]:
  if re.search(pattern,text,re.I):matches.add(mount)
 for match in re.finditer(r'\bCanon\s+(RF-S|EF-S|RF|EF)\b',text,re.I):matches.add('Canon '+match[1].upper())
 return next(iter(matches)) if len(matches)==1 else None

def lens_coverage(text,brand,mount):
 if re.search(r'APS[- ]C|\bDX\b|\bDC\b|Di\s*III[- ]A\b',text,re.I) or mount in {'Canon EF-S','Canon RF-S','Fujifilm X'}:return 'APS_C'
 if re.search(r'\bFE\b|full.frame|\bDG\b|Di\s*III\b',text,re.I):return 'FULL_FRAME'
 if brand=='Canon' and mount in {'Canon EF','Canon RF'} or brand=='Nikon' and mount=='Nikon Z':return 'FULL_FRAME'
 return None

def base(sid,name,key,title,price,url,at,kind='USED'):
 clean=title.replace('|',' ').strip()
 brand_match=re.search(r'\b(Sony|Sigma|Tamron|Canon|Nikon|Fujifilm)\b',clean,re.I)
 brand=brand_match[1].title() if brand_match else None
 if not brand:raise ValueError('Unsupported lens brand')
 mount=resolve_mount(clean,url)
 focal=re.search(r'(\d+)\s*(?:[-–]\s*(\d+))?\s*mm',clean,re.I)
 aperture=re.search(r'(?:\bf|(?<=mm)f)\s*/?\s*(\d+(?:\.\d+)?(?:[-–]\d+(?:\.\d+)?)?)',clean,re.I)
 return dict(retailerId=sid,retailerName=name,externalKey=key,brand=brand,model=clean[:150],modelCode=None,mount=mount,coverage=lens_coverage(clean,brand,mount),focalMin=int(focal[1]) if focal else None,focalMax=int(focal[2] or focal[1]) if focal else None,maxAperture=aperture[1] if aperture else None,autofocus=None,stabilized=None,conditionLabel='New' if kind=='NEW' else 'Used · grade unspecified',conditionNotes='Item-specific optical condition is not disclosed in the extracted listing. Confirm details with the seller.',fungus='UNKNOWN',scratches='UNKNOWN',haze='UNKNOWN',accessories=None,warrantyMonths=None,warrantyDetails=None,returnDays=None,pricePaise=price,shippingPaise=None,availability='UNKNOWN',sourceUrl=url,observedAt=at,demo=False,listingType=kind)
def identify(row, text):
 if row['brand']!='Sony':return row
 # Only the unambiguous FE 50/1.8 identity is cross-source matched in this pilot.
 if re.search(r'\bFE\s*50\s*mm\s*[fF]\s*/?\s*1\.8|\bSEL50F18F\b',text,re.I):
  row.update(model='FE 50mm F1.8',modelCode='SEL50F18F',coverage='FULL_FRAME',focalMin=50,focalMax=50,maxAperture='1.8',autofocus=True,stabilized=False)
 elif re.search(r'\bSEL50F18(?:/BC)?\b',text,re.I):
  row.update(model='E 50mm F1.8 OSS',modelCode='SEL50F18',coverage='APS_C',focalMin=50,focalMax=50,maxAperture='1.8',autofocus=True,stabilized=True)
 return row

def validate_destination(row):
 source=RETAILERS.get(row['retailerId'])
 target=urlparse(row['sourceUrl'])
 if not source or target.scheme!='https' or target.hostname!=source['host'] or target.username or target.port not in (None,443):
  raise ValueError('Only reviewed retail checkout destinations are supported')

def apply_cashify_terms(row,soup,product):
 descriptions=[soup.title.get_text() if soup.title else '',product.get('description','')]
 months=set()
 for script in soup.select('script[type="application/ld+json"]'):
  try: items=json.loads(script.get_text())
  except ValueError:continue
  if not isinstance(items,list):items=[items]
  for item in items:
   if not isinstance(item,dict) or item.get('@type') not in {'Product','ProductGroup'}:continue
   descriptions.extend([item.get('description',''),item.get('disambiguatingDescription','')])
   for prop in item.get('additionalProperty',[]):
    if prop.get('propertyID')=='warranty-months' and str(prop.get('value','')).isdigit():months.add(int(prop['value']))
 for description in descriptions:
  months.update(int(n) for n in re.findall(r'(\d{1,2})[- ]months?\s+(?:Cashify\s+)?warranty',description,re.I))
 if len(months)>1:
  row['warrantyMonths']=None
  row['warrantyDetails']='Conflicting source warranty claims ('+' and '.join(str(n)+' months' for n in sorted(months))+'). Confirm the applicable policy with Cashify. Refund terms also require confirmation; no refund duration is assumed.'
 elif len(months)==1:
  row['warrantyMonths']=months.pop()
  row['warrantyDetails']='Cashify seller warranty; exclusions and refund eligibility must be confirmed on the product page.'
 for prop in product.get('additionalProperty',[]):
  if prop.get('propertyID')=='refurbishment-grade':row['conditionLabel']='Refurbished · '+str(prop['value'])[:60]
 if 'Superb' in product.get('name',''):row['conditionLabel']='Refurbished · Superb'

def product_nodes(value):
 if isinstance(value,list):
  for v in value:yield from product_nodes(v)
 elif isinstance(value,dict):
  if value.get('@type')=='Product':yield value
  if '@graph' in value:yield from product_nodes(value['@graph'])
  if 'hasVariant' in value:yield from product_nodes(value['hasVariant'])
def parse_rating(aggregate):
 # Only exact 1–5 product aggregates with a disclosed positive count qualify.
 if not isinstance(aggregate,dict):return None
 try:
  if Decimal(str(aggregate.get('bestRating',5)))!=5 or Decimal(str(aggregate.get('worstRating',1)))!=1:return None
  value=Decimal(str(aggregate['ratingValue']))
  count_type='ratings' if 'ratingCount' in aggregate else 'reviews'
  raw=str(aggregate.get('ratingCount' if count_type=='ratings' else 'reviewCount','')).replace(',','')
  if not re.fullmatch(r'[0-9]+',raw):return None
  count=int(raw)
  if not value.is_finite() or not 1<=value<=5 or not 1<=count<=100_000_000:return None
  return dict(value=float(value),count=count,countType=count_type)
 except (ValueError,TypeError,KeyError,ArithmeticError):return None

def amazon_rating(card):
 star=card.select_one('.a-icon-alt')
 score=re.fullmatch(r'([1-5](?:\.\d+)?) out of 5 stars',star.get_text(strip=True)) if star else None
 if not score:return None
 for node in card.select('[aria-label]'):
  count=re.fullmatch(r'([0-9][0-9,]*) ratings?',node.get('aria-label',''))
  if count:return parse_rating({'ratingValue':score[1],'ratingCount':count[1]})
 return None

def parse_product(html,at,sid,name,url):
 soup=BeautifulSoup(html,'html.parser');rows={}
 for script in soup.select('script[type="application/ld+json"]'):
  try: products=list(product_nodes(json.loads(script.get_text())))
  except (ValueError,TypeError):continue
  for product in products:
   title=product.get('name','')
   if re.search(r'\b(adapter|filter|hood|cap|extender|teleconverter|camera|rental)\b',title,re.I):continue
   if not re.search(r'\b(Sony|Sigma|Tamron|Canon|Nikon|Fujifilm)\b',title,re.I) or 'rent' in title.lower():continue
   identity=title+' '+str(product.get('sku',''))
   offers=product.get('offers',[])
   if isinstance(offers,dict):offers=[offers]
   for offer in offers:
    if offer.get('priceCurrency')!='INR' or 'price' not in offer:continue
    link=urljoin(url,offer.get('url') or url)
    if urlparse(link).hostname!=urlparse(url).hostname:raise ValueError('Unexpected offer host')
    mount=resolve_mount(identity,link)
    if not mount:continue
    key=hashlib.sha256(link.encode()).hexdigest()[:24]
    condition=offer.get('itemCondition','').split('/')[-1]
    kind='REFURBISHED' if condition=='RefurbishedCondition' or re.search('refurbished|renewed',title,re.I) else 'USED' if condition=='UsedCondition' or sid in {'rk','dacby'} or re.search('used|pre.owned',title,re.I) else 'NEW'
    row=identify(base(sid,name,key,title,paise(offer['price']),link,at,kind),identity)
    row['mount']=mount
    if kind=='REFURBISHED':row['conditionLabel']='Refurbished · seller stated'
    status=offer.get('availability','').split('/')[-1]
    row['availability']={'InStock':'IN_STOCK','OutOfStock':'OUT_OF_STOCK','SoldOut':'OUT_OF_STOCK','BackOrder':'BACKORDER'}.get(status,'UNKNOWN')
    # WooCommerce sometimes labels backorders InStock in JSON-LD. Read the
    # exact variation's rendered stock text, never related-product stock.
    if sid=='fotocentre':
     selected=parse_qs(urlparse(link).query).get('attribute_pa_mounts',[None])[0]
     stock=None
     if selected:
      for form in soup.select('[data-product_variations]'):
       variants=json.loads(form['data-product_variations'])
       if not isinstance(variants,list):continue
       for variant in variants:
        if variant.get('attributes',{}).get('attribute_pa_mounts')==selected:
         stock=BeautifulSoup(variant.get('availability_html',''),'html.parser').get_text(' ',strip=True).lower()
     else:
      node=soup.select_one('.summary p.stock')
      if node:stock=node.get_text(' ',strip=True).lower()
     if stock:
      if 'backorder' in stock:row['availability']='BACKORDER'
      elif 'out of stock' in stock:row['availability']='OUT_OF_STOCK'
      elif 'in stock' in stock:row['availability']='IN_STOCK'
    sku=offer.get('sku','')
    if kind=='USED':
     grade=next((g for g in ['EXCELLENT PLUS','EXCELLENT','VERY GOOD','GOOD'] if sku.endswith(g)),None)
     if grade:row['conditionLabel']='Used · '+grade.title()
    row['conditionNotes']=('New retail listing. ' if kind=='NEW' else 'Refurbished listing; optics not independently inspected. ' if kind=='REFURBISHED' else 'Used listing; condition grades describe the seller’s category, not an independent inspection. ')+'Price and stock were read from the retailer’s product data. Confirm warranty, delivery and the final total on the seller site.'
    if row['availability']=='BACKORDER':row['conditionNotes']+=' Seller accepts backorders; dispatch date is not confirmed. Confirm the wait time before payment.'
    if sid=='flipkart':row['conditionNotes']+=' Marketplace seller and delivery eligibility may vary by location; this is not a guaranteed checkout quote.'
    rating=parse_rating(product.get('aggregateRating'))
    if rating:row['productRating']=rating
    validate_destination(row)
    if sid=='cashify':apply_cashify_terms(row,soup,product)
    rows[key]=row
 if not rows:raise ValueError('No supported INR product offers found')
 return list(rows.values())

def parse_amazon(html,at):
 soup=BeautifulSoup(html,'html.parser');rows=[]
 for card in soup.select('[data-component-type="s-search-result"]'):
  asin=card.get('data-asin')
  if asin not in AMAZON:continue
  price=card.select_one('.a-price:not(.a-text-price) .a-offscreen')
  link=next((a.get('href') for a in card.select('a[href]') if '/dp/'+asin in a.get('href','') and '/sspa/' not in a['href']),None)
  if not price or not link:continue
  brand,title,code,coverage,lo,hi,aperture,stabilized=AMAZON[asin]
  url=urljoin('https://www.amazon.in',link).split('/ref=')[0].split('?')[0]
  row=base('amazon','Amazon India',asin,brand+' '+title,paise(price.get_text()),url,at,'NEW')
  row.update(mount='Sony E',brand=brand,model=title,modelCode=code,coverage=coverage,focalMin=lo,focalMax=hi,maxAperture=aperture,autofocus=True,stabilized=stabilized)
  row['conditionNotes']='New marketplace listing. Displayed search-result price before conditional coupons or bank offers; seller, shipping and availability must be confirmed on the product page. Search observation is not a guaranteed checkout quote.'
  rating=amazon_rating(card)
  if rating:row['productRating']=rating
  rows.append(row)
 if not rows:raise ValueError('No supported Amazon prices; page may require verification or its layout changed')
 return list({r['externalKey']:r for r in rows}.values())

def refresh(previous,reader=fetch):
 rows=[];statuses=[]
 for sid,name,url,scope in SOURCES:
  checked=now()
  try:
   gathered=[]
   urls=PRODUCTS.get(sid,[url])
   for source in urls:
    html,at=reader(source)
    gathered.extend(parse_amazon(html,at) if sid=='amazon' else parse_product(html,at,sid,name,source))
    if reader is fetch:time.sleep(1)
   if not gathered:raise ValueError('Empty source result')
   for row in gathered:validate_destination(row)
   rows.extend(gathered)
   statuses.append(dict(id=sid,name=name,url=url,storeType=RETAILERS[sid]['type'],status='OK',checkedAt=checked,lastSuccessAt=max(r['observedAt'] for r in gathered),offers=len(gathered),scope=scope,message='Public pages checked; selected products only.'))
  except Exception as exc:
   kept=[r for r in previous.get('observations',[]) if r['retailerId']==sid]
   rows.extend(kept)
   statuses.append(dict(id=sid,name=name,url=url,storeType=RETAILERS[sid]['type'],status='RETAINED' if kept else 'UNAVAILABLE',checkedAt=checked,lastSuccessAt=max((r['observedAt'] for r in kept),default=None),offers=len(kept),scope=scope,message='Refresh failed; previous observations retain their original timestamps.' if kept else 'No verified listings available.',error=type(exc).__name__+': '+str(exc)[:150]))
 return dict(generatedAt=now(),sources=statuses,observations=rows)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'catalogue'/'live.json');args=parser.parse_args()
 previous=json.loads(args.output.read_text()) if args.output.exists() else {}
 result=refresh(previous)
 args.output.parent.mkdir(parents=True,exist_ok=True)
 temp=args.output.with_suffix('.tmp');temp.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n');temp.replace(args.output)
 for s in result['sources']:print(f"{s['name']}: {s['status']} · {s['offers']} offers"+(f" · {s['error']}" if 'error' in s else ''))
 print(f"Saved {len(result['observations'])} real offers to {args.output}")
 if not any(s['status']=='OK' for s in result['sources']):raise SystemExit(1)
if __name__=='__main__':main()
