"""Read-only local API checks; no source-network or paid AI calls."""
import json
from urllib.request import urlopen
from urllib.parse import urlencode
BASE='http://127.0.0.1:8086'
checks=0
def get(path,**query):
 with urlopen(BASE+path+('?' + urlencode(query) if query else ''),timeout=5) as r:return json.load(r)
def check(condition,message):
 global checks
 assert condition,message
 checks+=1
 print('PASS',message)
default_data=get('/api/catalog',size=48)
check(all(o['availability']!='OUT_OF_STOCK' for o in default_data['offers']),'sold-out offers are hidden by default')
all_data=get('/api/catalog',size=48,includeSoldOut='true')
offers=all_data['offers']
check(not all_data['demo'],'real mode is active')
check(len(offers)==all_data['total'] and len(offers)>10,'real catalogue is populated')
check(all(not o['demo'] and o['source_url'].startswith('https://') for o in offers),'all offers have actual HTTPS destinations and no demo flags')
check({o['retailer_id'] for o in offers}=={'amazon','rk','cameraclub','sony','flipkart','srishti','pooja','cashify','dacby','fotocentre','justcanon','fujifilm'},'twelve actual source platforms are represented')
new=get('/api/catalog',listingType='NEW',size=48)['offers']
check(bool(new) and all(o['listing_type']=='NEW' for o in new),'new filter does not include used offers')
used=get('/api/catalog',listingType='USED',size=48)['offers']
check(bool(used) and all(o['listing_type']=='USED' for o in used),'used filter does not include new offers')
amazon=get('/api/catalog',retailer='amazon',size=48)['offers']
check(bool(amazon) and all(o['retailer_id']=='amazon' for o in amazon),'Amazon filter returns only Amazon listings')
check(all('/dp/' in o['source_url'] for o in amazon),'Amazon offers link to actual product pages')
check(any(o['availability']=='OUT_OF_STOCK' for o in offers),'sold-out source variants remain explicit')
stock=get('/api/catalog',inStockOnly='true',size=48)['offers']
check(bool(stock) and all(o['availability']=='IN_STOCK' for o in stock),'in-stock filter excludes unknown and sold-out offers')
check(any(o['price_paise']%100 for o in offers),'fractional INR source prices preserve paise')
check(all(o['fungus']=='UNKNOWN' for o in offers),'generic condition grades are not converted to fungus-free claims')
matching=[o for o in offers if o['model_code']=='SEL50F18F' and o['retailer_id'] in {'rk','amazon'}]
comparison=get('/api/compare',ids=','.join(o['id'] for o in matching))
check(comparison['modelMatch']=='MATCHING_VARIANT','reviewed FE 50mm identity matches across real retailers')
check({o['listing_type'] for o in comparison['offers']}=={'USED','NEW'},'comparison retains distinct purchase types')
check(len(get('/api/sources')['sources'])==12,'coverage endpoint reports all twelve configured sources')
refurb=get('/api/catalog',listingType='REFURBISHED',size=48,includeSoldOut='true')['offers']
check(len(refurb)==2 and all(o['retailer_id']=='cashify' for o in refurb),'refurbished filter returns Cashify grade variants')
check(all(o['warranty_months'] is None and o['return_days'] is None and 'Conflicting' in o['warranty_details'] for o in refurb),'conflicting Cashify policies remain unconfirmed')
canon=get('/api/catalog',mount='Canon EF-S',size=48)['offers']
check(len(canon)==1 and canon[0]['retailer_id']=='dacby','Canon mount filter returns the Dacby lens')
check(all(o['mount']=='Sony E' for o in get('/api/catalog',mount='Sony E',size=48)['offers']),'Sony mount filter excludes Canon')
check(not any('tapprs' in o['source_url'] for o in offers),'Tapprs destinations are absent')
rf=get('/api/catalog',mount='Canon RF',brand='Canon',size=48)['offers']
check(len(rf)==1 and rf[0]['retailer_id']=='justcanon' and rf[0]['brand']=='Canon','Just Canon RF offer has correct mount and manufacturer')
foto=get('/api/catalog',retailer='fotocentre',size=48)['offers']
check(any(o['model_code']=='SEL50F18F' and o['price_paise']==2119900 for o in foto),'Fotocentre product price excludes crossed-out MRP')
check('/products/' in rf[0]['source_url'] and '/product/' in foto[0]['source_url'],'new stores use direct product destinations')
rated=[o for o in offers if o['product_rating'] is not None]
check(bool(rated) and all(1<=o['product_rating']<=5 and o['product_rating_count']>0 and o['product_rating_count_type'] in {'ratings','reviews'} for o in rated),'ratings include bounded scores and positive source-specific counts')
check(any(o['retailer_id']=='amazon' for o in rated),'Amazon ratings are parsed with exact counts')
check(any(o['product_rating'] is None for o in offers),'missing ratings remain null rather than zero or guessed')
check(all(o['retailer_id'] in {'amazon','flipkart','dacby','cashify'} for o in rated),'ratings only appear for sources publishing product review evidence')
check(len(default_data['offers'])<len(offers),'sold-out opt-in restores reference offers')
check({o['brand'] for o in offers}=={'Sony','Canon','Nikon','Fujifilm','Sigma','Tamron'},'six manufacturers are represented')
for brand,mount in [('Nikon','Nikon Z'),('Fujifilm','Fujifilm X')]:
 rows=get('/api/catalog',brand=brand,mount=mount,size=48)['offers']
 check(bool(rows) and all(o['brand']==brand and o['mount']==mount for o in rows),brand+' manufacturer and mount filters work')
backorders=[o for o in offers if o['availability']=='BACKORDER']
check(len(backorders)==5 and all(o['id'] not in {x['id'] for x in stock} for o in backorders),'five backorders are explicit and excluded from in-stock results')
tamron=get('/api/catalog',brand='Tamron',size=48)['offers']
check({o['mount'] for o in tamron}=={'Sony E','Nikon Z'} and len({o['source_url'] for o in tamron})==2,'Tamron mount variants keep separate direct product links')
fuji=get('/api/catalog',retailer='fujifilm',size=48)['offers']
check(len(fuji)==1 and fuji[0]['coverage']=='APS_C' and fuji[0]['price_paise']==1950000,'Fujifilm authorised store offer retains price and sensor format')
print(f'{checks} read-only live API checks passed')
