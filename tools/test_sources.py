import unittest
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from refresh_sources import parse_amazon,parse_product,paise,refresh,base,validate_destination,RETAILERS,parse_rating,amazon_rating,save_snapshot,write_summary,SOURCES,parse_sigma_india
AT='2026-10-31T10:00:00Z'
class SourceContractTests(unittest.TestCase):
 def fixture(self,name):return (Path(__file__).parent/'fixtures'/name).read_text()
 def test_sigma_family_is_one_unmatched_offer_not_four_mount_quotes(self):
  rows=parse_sigma_india(self.fixture('sigma-family.html'),AT)
  self.assertEqual(len(rows),1)
  row=rows[0];validate_destination(row)
  self.assertEqual(row['pricePaise'],5280000)
  self.assertIsNone(row['mount']);self.assertIsNone(row['modelCode'])
  self.assertEqual(row['availability'],'UNKNOWN')
  self.assertEqual(row['coverage'],'APS_C')
  self.assertIn('mount unconfirmed',row['conditionLabel'])
  self.assertIn('Canon RF Mount',row['conditionNotes'])
 def test_sigma_requires_exact_product_and_purchase_control(self):
  html=self.fixture('sigma-family.html')
  for bad in [html.replace('18-50mm','16-28mm'),html.replace('value="573"','value="999"'),html.replace('type="submit"','disabled type="submit"')]:
   with self.subTest(),self.assertRaises(ValueError):parse_sigma_india(bad,AT)
 def test_sigma_does_not_fall_back_to_crossed_out_mrp(self):
  from bs4 import BeautifulSoup
  soup=BeautifulSoup(self.fixture('sigma-family.html'),'html.parser');soup.select_one('ins').decompose()
  with self.assertRaises(ValueError):parse_sigma_india(str(soup),AT)
 def test_brand_is_manufacturer_not_camera_mount(self):
  row=base("amazon","Amazon India","one","Sigma 35mm f/1.4 DG HSM Art [for Sony]",3450000,"https://www.amazon.in/dp/TEST",AT)
  self.assertEqual(row["brand"],"Sigma")
 def test_decimal_price_preserves_paise(self):
  self.assertEqual(paise('₹12,468.75'),1246875)
 def test_grade_does_not_imply_clean_optics_or_stock(self):
  data={'@type':'Product','name':'USED Sony FE 50mm F1.8','offers':{'priceCurrency':'INR','price':12000,'sku':'Lens GOOD'}}
  row=parse_product('<script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'cameraclub','Camera Club India','https://cameraclub.in/products/lens')[0]
  self.assertEqual((row['fungus'],row['haze'],row['availability']),('UNKNOWN','UNKNOWN','UNKNOWN'))
 def test_variant_stock_and_exact_price_are_preserved(self):
  data={'@type':'Product','name':'USED I Sony FE 50mm F1.8','offers':[{'priceCurrency':'INR','price':12468.75,'availability':'https://schema.org/OutOfStock','url':'https://cameraclub.in/products/lens?variant=1','sku':'Lens EXCELLENT'}]}
  r=parse_product('<script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'cameraclub','Camera Club India','https://cameraclub.in/products/lens')[0]
  self.assertEqual((r['pricePaise'],r['availability'],r['conditionLabel']),(1246875,'OUT_OF_STOCK','Used · Excellent'))
 def test_flipkart_oss_is_not_full_frame_fe_variant(self):
  data=[{'@type':'Product','name':'SONY SEL50F18/BC Standard Prime Lens','sku':'STORE-ID','offers':{'priceCurrency':'INR','price':21023,'availability':'https://schema.org/InStock'}}]
  r=parse_product('<script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'flipkart','Flipkart','https://www.flipkart.com/lens/p/one')[0]
  self.assertEqual((r['modelCode'],r['coverage'],r['stabilized']),('SEL50F18','APS_C',True))
  self.assertEqual(r['listingType'],'NEW')
 def test_manufacturer_sku_identifies_reordered_title(self):
  data={'@type':'Product','name':'Sony 50mm 1.8 FE Lens','sku':'SEL50F18F','offers':{'priceCurrency':'INR','price':19499,'availability':'https://schema.org/InStock'}}
  r=parse_product('<script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'srishti','Srishti Digilife','https://www.srishtidigilife.co.in/products/lens')[0]
  self.assertEqual((r['modelCode'],r['coverage'],r['stabilized']),('SEL50F18F','FULL_FRAME',False))
 def test_foreign_currency_is_not_inr(self):
  data={'@type':'Product','name':'Sony FE 50mm F1.8','offers':{'priceCurrency':'USD','price':200}}
  with self.assertRaises(ValueError):parse_product('<script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'sony','Sony','https://shopatsc.com/products/lens')
 def test_amazon_does_not_use_mrp_coupon_or_accessory_price(self):
  html='''<div data-component-type="s-search-result" data-asin="B01DLMD5O6"><a href="/lens/dp/B01DLMD5O6/ref=test">Sony FE 50mm</a><span class="a-price a-text-price"><span class="a-offscreen">₹20,990</span></span><span class="a-price"><span class="a-offscreen">₹19,490</span></span><span>Coupon price ₹18,990</span></div><div data-component-type="s-search-result" data-asin="ACCESSORY"><span class="a-price"><span class="a-offscreen">₹500</span></span></div>'''
  r=parse_amazon(html,AT)
  self.assertEqual(len(r),1);self.assertEqual(r[0]['pricePaise'],1949000);self.assertEqual(r[0]['availability'],'UNKNOWN')
 def test_failed_sources_keep_original_observation_time(self):
  old={'retailerId':'amazon','externalKey':'one','observedAt':AT,'pricePaise':1000000}
  def fail(url):raise TimeoutError('offline')
  result=refresh({'observations':[old]},fail)
  self.assertEqual(result['observations'],[old])
  source=next(s for s in result['sources'] if s['id']=='amazon')
  self.assertEqual(source['status'],'RETAINED');self.assertEqual(source['lastSuccessAt'],AT)
 def test_total_failure_does_not_replace_existing_file(self):
  with TemporaryDirectory() as directory:
   output=Path(directory)/'live.json';output.write_text('{"existing":"catalogue"}\n')
   original=output.read_bytes()
   result=refresh({},lambda url:(_ for _ in ()).throw(TimeoutError('offline')))
   with self.assertRaisesRegex(ValueError,'No source refreshed'):save_snapshot(output,result)
   self.assertEqual(output.read_bytes(),original)
   self.assertFalse(output.with_suffix('.tmp').exists())
 def test_partial_store_failure_retains_whole_store_and_publishes_other_success(self):
  old=base('fotocentre','Foto Centre India','old','Sony FE 50mm f/1.8 Lens',2000000,'https://fotocentreindia.com/product/old/',AT,'NEW')
  urls={'fotocentre':['https://fotocentreindia.com/product/one/','https://fotocentreindia.com/product/two/'],
        'sony':['https://shopatsc.com/products/lens']}
  html=self.product('Sony FE 50mm f/1.8 Lens',{'priceCurrency':'INR','price':21000,'availability':'https://schema.org/InStock'})
  def reader(url):
   if url.endswith('/two/'):raise TimeoutError('second product failed')
   return html,'2026-11-01T10:00:00Z'
  with patch('refresh_sources.SOURCES',[s for s in SOURCES if s[0] in urls]),patch('refresh_sources.PRODUCTS',urls):
   result=refresh({'observations':[old]},reader)
  self.assertEqual([r for r in result['observations'] if r['retailerId']=='fotocentre'],[old])
  self.assertEqual({s['id']:s['status'] for s in result['sources']},{'fotocentre':'RETAINED','sony':'OK'})
  with TemporaryDirectory() as directory:
   output=Path(directory)/'live.json';save_snapshot(output,result)
   self.assertEqual(json.loads(output.read_text()),result)
   report=Path(directory)/'summary.md';write_summary(report,result)
   self.assertIn('RETAINED',report.read_text());self.assertIn(AT,report.read_text())
 def test_duplicate_listing_rejects_snapshot_without_replacing_previous(self):
  row=base('sony','ShopAtSC','one','Sony FE 50mm f/1.8 Lens',2000000,'https://shopatsc.com/products/lens',AT,'NEW')
  with TemporaryDirectory() as directory:
   output=Path(directory)/'live.json';output.write_text('previous snapshot')
   with self.assertRaisesRegex(ValueError,'Duplicate'):
    save_snapshot(output,{'sources':[{'status':'OK'}],'observations':[row,row]})
   self.assertEqual(output.read_text(),'previous snapshot')
 def test_excludes_private_sellers_and_tapprs(self):
  for sid in ['tapprs','olx','facebook','quikr','techenclave']:
   self.assertNotIn(sid,RETAILERS)
   with self.assertRaises(ValueError):validate_destination({'retailerId':sid,'sourceUrl':'https://example.com/item'})
 def test_refurbished_variants_do_not_become_new_or_gain_guessed_warranty(self):
  variant={'@type':'Product','name':'Sony FE 28mm f/2 Refurbished, Superb','offers':{'priceCurrency':'INR','price':20999,'itemCondition':'https://schema.org/RefurbishedCondition','availability':'https://schema.org/OutOfStock','url':'https://www.cashify.in/lens/1'}}
  data={'@type':'ProductGroup','description':'6 months warranty','additionalProperty':[{'propertyID':'warranty-months','value':'1'}],'hasVariant':[variant]}
  rows=parse_product('<title>6-Month Warranty</title><script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'cashify','Cashify','https://www.cashify.in/lens')
  self.assertEqual(len(rows),1)
  self.assertEqual((rows[0]['listingType'],rows[0]['availability']),('REFURBISHED','OUT_OF_STOCK'))
  self.assertIsNone(rows[0]['warrantyMonths']);self.assertIsNone(rows[0]['returnDays'])
  self.assertIn('Conflicting',rows[0]['warrantyDetails'])
 def test_preowned_canon_has_correct_mount(self):
  data={'@type':'Product','name':'Canon EF-S 55-250mm f/4.0-5.6 IS II Lens','offers':{'priceCurrency':'INR','price':6999,'itemCondition':'https://schema.org/UsedCondition'}}
  r=parse_product('<script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'dacby','Dacby','https://dacby.com/buy/lens')[0]
  self.assertEqual((r['listingType'],r['mount'],r['coverage']),('USED','Canon EF-S','APS_C'))
 def test_canon_mounts_are_distinct_and_store_brand_is_not_manufacturer(self):
  for mount,coverage in [('RF','FULL_FRAME'),('RF-S','APS_C'),('EF','FULL_FRAME'),('EF-S','APS_C')]:
   with self.subTest(mount=mount):
    data={'@type':'Product','name':'Canon '+mount+' 50mm f/1.8 STM','brand':{'name':'Just Canon'},'offers':{'priceCurrency':'INR','price':18995,'availability':'https://schema.org/InStock','url':'/products/lens?variant=1'}}
    row=parse_product('<script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'justcanon','Just Canon','https://www.justcanon.in/products/lens')[0]
    self.assertEqual((row['brand'],row['mount'],row['coverage'],row['listingType']),('Canon','Canon '+mount,coverage,'NEW'))
    self.assertEqual(row['sourceUrl'],'https://www.justcanon.in/products/lens?variant=1')
 def test_fotocentre_uses_offer_price_not_mrp_and_matches_fe_model(self):
  data={'@type':'Product','name':'Sony FE 50mm f/1.8 Lens','sku':'SEL50F18F','offers':{'priceCurrency':'INR','price':'21199','priceSpecification':{'price':'22990','priceCurrency':'INR'},'availability':'https://schema.org/InStock'}}
  row=parse_product('<script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'fotocentre','Foto Centre India','https://fotocentreindia.com/product/lens/')[0]
  self.assertEqual((row['pricePaise'],row['modelCode'],row['mount']),(2119900,'SEL50F18F','Sony E'))
 def test_adapters_and_accessories_are_not_lens_offers(self):
  for title in ['7Artisans 4-in-1 Adapter for PL Mount Lenses','Sony FE 50mm Lens Hood','Canon RF 50mm lens cap','Canon RF to PL Adapter']:
   data={'@type':'Product','name':title,'offers':{'priceCurrency':'INR','price':1000}}
   with self.subTest(title=title),self.assertRaises(ValueError):parse_product('<script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'fotocentre','Foto Centre India','https://fotocentreindia.com/product/accessory/')
 def test_ratings_keep_exact_count_and_count_kind(self):
  self.assertEqual(parse_rating({'ratingValue':4.5,'ratingCount':580,'reviewCount':61}),{'value':4.5,'count':580,'countType':'ratings'})
  self.assertEqual(parse_rating({'ratingValue':'4.4','reviewCount':'189'}),{'value':4.4,'count':189,'countType':'reviews'})
 def test_incomplete_invalid_or_different_scale_ratings_stay_unknown(self):
  for data in [None,{}, {'ratingValue':5}, {'ratingValue':0,'ratingCount':3}, {'ratingValue':6,'ratingCount':3}, {'ratingValue':'NaN','ratingCount':3}, {'ratingValue':4,'ratingCount':0}, {'ratingValue':4,'ratingCount':'7.1K'}, {'ratingValue':4,'ratingCount':3,'bestRating':10}]:
   with self.subTest(data=data):self.assertIsNone(parse_rating(data))
 def test_amazon_uses_exact_accessible_count_not_rounded_display(self):
  from bs4 import BeautifulSoup
  card=BeautifulSoup('<span class="a-icon-alt">4.4 out of 5 stars</span><a aria-label="7,128 ratings">(7.1K)</a>','html.parser')
  self.assertEqual(amazon_rating(card),{'value':4.4,'count':7128,'countType':'ratings'})
  card.find('a')['aria-label']='7.1K ratings'
  self.assertIsNone(amazon_rating(card))
 def test_only_product_aggregate_is_attached_not_store_or_related_reviews(self):
  data=[{'@type':'Organization','aggregateRating':{'ratingValue':5,'ratingCount':5000}},{'@type':'Product','name':'Sony FE 50mm f/1.8 Lens','offers':{'priceCurrency':'INR','price':20000}}]
  html='<script type="application/ld+json">'+json.dumps(data)+'</script>'
  row=parse_product(html,AT,'fotocentre','Foto Centre India','https://fotocentreindia.com/product/lens/')[0]
  self.assertNotIn('productRating',row)
  data[1]['aggregateRating']={'ratingValue':4.1,'reviewCount':10}
  row=parse_product('<script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'fotocentre','Foto Centre India','https://fotocentreindia.com/product/lens/')[0]
  self.assertEqual(row['productRating'],{'value':4.1,'count':10,'countType':'reviews'})
 def product(self,title,offers,extra=''):
  data={'@type':'Product','name':title,'offers':offers}
  return '<script type="application/ld+json">'+json.dumps(data)+'</script>'+extra
 def test_nikon_and_compact_fujifilm_titles(self):
  for title,sid,url,mount,coverage,aperture in [
   ('Nikon Z 35mm f/1.4 Lens','fotocentre','https://fotocentreindia.com/product/lens/','Nikon Z','FULL_FRAME','1.4'),
   ('Nikon Z DX 35mm f/1.7 Macro Lens','fotocentre','https://fotocentreindia.com/product/lens/','Nikon Z','APS_C','1.7'),
   ('FUJIFILM XC35MMF2','fujifilm','https://fujifilmxindia.com/products/lens','Fujifilm X','APS_C','2')]:
   with self.subTest(title=title):
    r=parse_product(self.product(title,{'priceCurrency':'INR','price':19500}),AT,sid,sid,url)[0]
    self.assertEqual((r['mount'],r['coverage'],r['focalMin'],r['maxAperture']),(mount,coverage,35,aperture))
 def test_mount_variant_prices_stock_and_links_do_not_merge(self):
  url='https://fotocentreindia.com/product/tamron/'
  offers=[{'priceCurrency':'INR','price':58090,'url':url+'?attribute_pa_mounts=nikon-z','availability':'https://schema.org/OutOfStock'},
          {'priceCurrency':'INR','price':64400,'url':url+'?attribute_pa_mounts=sony-e','availability':'https://schema.org/BackOrder'}]
  rows=parse_product(self.product('Tamron 28-75mm f/2.8 Di III Lens',offers),AT,'fotocentre','Foto Centre India',url)
  self.assertEqual([(r['brand'],r['mount'],r['pricePaise'],r['availability']) for r in rows],[('Tamron','Nikon Z',5809000,'OUT_OF_STOCK'),('Tamron','Sony E',6440000,'BACKORDER')])
  self.assertNotEqual(rows[0]['externalKey'],rows[1]['externalKey'])
  self.assertIn('nikon-z',rows[0]['sourceUrl']);self.assertIn('sony-e',rows[1]['sourceUrl'])
 def test_third_party_crop_lens_is_not_full_frame_because_mount_is_rf(self):
  url='https://fotocentreindia.com/product/sigma/?attribute_pa_mounts=canon-rf'
  r=parse_product(self.product('Sigma 12mm F/1.4 DC Contemporary Lens',{'priceCurrency':'INR','price':49000}),AT,'fotocentre','Foto Centre India',url)[0]
  self.assertEqual((r['brand'],r['mount'],r['coverage']),('Sigma','Canon RF','APS_C'))
 def test_unknown_or_ambiguous_mount_is_not_assumed_sony(self):
  for title in ['Tamron 28-75mm f/2.8 Lens','Sigma 18-50mm f/2.8 for Sony E / Fujifilm X','Nikon 50mm lens','Fujifilm GF 50mm lens','Nikon Z camera with 35mm lens']:
   with self.subTest(title=title),self.assertRaises(ValueError):
    parse_product(self.product(title,{'priceCurrency':'INR','price':30000}),AT,'fotocentre','Foto Centre India','https://fotocentreindia.com/product/lens/')
 def test_backorder_overrides_generic_instock_and_ignores_related_stock(self):
  html=self.product('Nikon Z 26mm f/2.8 Lens',{'priceCurrency':'INR','price':46400,'availability':'https://schema.org/InStock'},'<div class="summary"><p class="stock available-on-backorder">Available on backorder</p></div><div class="related"><p class="stock">In stock</p></div>')
  r=parse_product(html,AT,'fotocentre','Foto Centre India','https://fotocentreindia.com/product/lens/')[0]
  self.assertEqual(r['availability'],'BACKORDER');self.assertIn('dispatch date is not confirmed',r['conditionNotes'])
 def test_variant_backorder_does_not_inherit_another_mount_stock(self):
  url='https://fotocentreindia.com/product/lens/'
  variants=[{'attributes':{'attribute_pa_mounts':'sony-e'},'availability_html':'<p>Available on backorder</p>'}, {'attributes':{'attribute_pa_mounts':'nikon-z'},'availability_html':'<p>Only 1 left in stock</p>'}]
  import html
  extra='<form data-product_variations="'+html.escape(json.dumps(variants),quote=True)+'"></form>'
  offers=[{'priceCurrency':'INR','price':40000,'availability':'https://schema.org/InStock','url':url+'?attribute_pa_mounts='+m} for m in ['sony-e','nikon-z']]
  rows=parse_product(self.product('Tamron 70-300mm f/4.5-6.3 Di III Lens',offers,extra),AT,'fotocentre','Foto Centre India',url)
  self.assertEqual([r['availability'] for r in rows],['BACKORDER','IN_STOCK'])

if __name__=='__main__':unittest.main()

