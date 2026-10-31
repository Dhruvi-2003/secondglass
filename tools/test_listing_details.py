import json
import unittest
from bs4 import BeautifulSoup
from listing_details import enrich, enrich_policy, POLICIES
from refresh_sources import base, parse_product, refresh, SOURCES
from unittest.mock import patch
AT='2026-11-01T00:00:00Z'

class DetailsTests(unittest.TestCase):
 def row(self,sid='fotocentre',kind='NEW'):
  return base(sid,sid,'one','Sony FE 50mm F1.8',2000000,'https://fotocentreindia.com/product/lens/',AT,kind)
 def test_conditional_extension_is_not_unconditional_three_year_cover(self):
  r=self.row('fujifilm')
  enrich(r,BeautifulSoup('<span class="feature-item__text">2+1 Year Warranty</span><span class="warranty-tooltip">Register within 30 days for 1 year additional warranty.</span>','html.parser'))
  self.assertEqual(r['warrantyMonths'],24)
  self.assertIn('Register within 30 days',r['warrantyDetails'])
  self.assertEqual(r['listingDetails']['warrantyType'],'MANUFACTURER')
 def test_conflicting_source_warranties_are_not_silently_resolved(self):
  r=self.row()
  html='<div class="summary"><div class="woocommerce-product-details__short-description"><li>Warranty: Sony India 2 Years Warranty</li></div></div><div id="tab-description"><p>Backed by a 1-year warranty.</p></div>'
  enrich(r,BeautifulSoup(html,'html.parser'))
  self.assertIsNone(r['warrantyMonths']);self.assertEqual(r['listingDetails']['warrantyType'],'CONFLICTING')
  self.assertEqual(len([e for e in r['listingDetails']['evidence'] if e['field']=='warranty']),2)
 def test_store_review_medals_do_not_become_product_ratings(self):
  r=self.row('sony')
  html='<div class="jdgm-all-reviews-text" data-average-rating="4.9" data-number-of-reviews="9000"></div><div class="jdgm-preview-badge" data-template="product"><div class="jdgm-prev-badge" data-average-rating="0" data-number-of-reviews="0"></div></div>'
  enrich(r,BeautifulSoup(html,'html.parser'))
  self.assertNotIn('productRating',r);self.assertEqual(r['listingDetails']['ratingStatus'],'NO_REVIEWS')
 def test_product_widget_extracts_real_reviews(self):
  r=self.row('sony')
  enrich(r,BeautifulSoup('<div id="judgeme_product_reviews"><div class="jdgm-rev-widg" data-average-rating="4.8" data-number-of-reviews="12"></div></div>','html.parser'))
  self.assertEqual(r['productRating'],dict(value=4.8,count=12,countType='reviews'))
 def test_matching_group_rating_is_inherited_by_its_variants(self):
  data={'@type':'ProductGroup','aggregateRating':{'ratingValue':5,'ratingCount':1},'hasVariant':[{'@type':'Product','name':'Sony FE 28mm F2 Refurbished','offers':{'priceCurrency':'INR','price':20000}}]}
  r=parse_product('<script type="application/ld+json">'+json.dumps(data)+'</script>',AT,'cashify','Cashify','https://www.cashify.in/product')[0]
  self.assertEqual(r['productRating']['count'],1)
  self.assertTrue(any(e['scope']=='PRODUCT_FAMILY' for e in r['listingDetails']['evidence']))
 def test_repeated_variant_does_not_lose_its_family_rating(self):
  child={'@type':'Product','sku':'variant-1','name':'Sony FE 28mm F2 Refurbished','offers':{'priceCurrency':'INR','price':20000}}
  group={'@type':'ProductGroup','aggregateRating':{'ratingValue':5,'ratingCount':1},'hasVariant':[child]}
  html=''.join('<script type="application/ld+json">'+json.dumps(d)+'</script>' for d in [group,child])
  r=parse_product(html,AT,'cashify','Cashify','https://www.cashify.in/product')[0]
  self.assertEqual(r['productRating']['value'],5)
 def test_replacement_only_is_not_refundable_returns_or_seo_window(self):
  r=self.row('flipkart')
  enrich(r,BeautifulSoup('','html.parser'),{'description':'30 Day Replacement Guarantee.'},{'hasMerchantReturnPolicy':{'returnPolicyCategory':'https://schema.org/MerchantReturnNotPermitted','description':'Returns are not permitted. 7 days replacement-only policy.'}})
  self.assertEqual(r['listingDetails']['returnPolicy'],'REPLACEMENT_ONLY');self.assertIsNone(r['returnDays'])
 def test_cashify_refund_conflict_keeps_both_claims_without_days(self):
  r=self.row('cashify','REFURBISHED')
  html='<div><h2>48</h2><span>Hours Refund*</span></div>'
  enrich(r,BeautifulSoup(html,'html.parser'),parent={'disambiguatingDescription':'Backed by 15-day refund.'})
  self.assertEqual(r['listingDetails']['returnPolicy'],'CONFLICTING');self.assertIsNone(r['returnDays'])
  self.assertIn('15-day',r['listingDetails']['returnDetails']);self.assertIn('48 Hours',r['listingDetails']['returnDetails'])
 def test_processing_days_never_become_a_return_window(self):
  r=self.row('sony');enrich(r,BeautifulSoup('','html.parser'))
  enrich_policy(r,'<main>After a cancelation request, payment gateway charges are deducted; refund takes 7 to 10 working days.</main>',POLICIES['sony'])
  self.assertIsNone(r['returnDays']);self.assertEqual(r['listingDetails']['returnPolicy'],'CANCELLATION_ONLY')
  self.assertEqual(r['listingDetails']['evidence'][0]['scope'],'STORE_POLICY')
 def test_policy_layout_failure_does_not_claim_no_returns(self):
  r=self.row('justcanon');enrich(r,BeautifulSoup('','html.parser'))
  enrich_policy(r,'<main>Page not found</main>',POLICIES['justcanon'])
  self.assertEqual(r['listingDetails']['returnPolicy'],'UNKNOWN')
 def test_condition_chart_reviews_and_body_scratches_are_not_optical_claims(self):
  r=self.row('cameraclub','USED')
  enrich(r,BeautifulSoup('<section>Condition chart: New - full warranty; Glass no fungus.</section><div class="review">Glass scratches present.</div>','html.parser'),{'description':'Body scratches present. Excellent grade. All lenses undergo checks for fungus.'})
  self.assertEqual([r[f] for f in ['fungus','haze','scratches']],['UNKNOWN']*3)
  self.assertIsNone(r['warrantyMonths']);self.assertIsNone(r['accessories'])
 def test_explicit_optical_claim_is_linked_to_used_listing(self):
  r=self.row('rk','USED');enrich(r,BeautifulSoup('','html.parser'),{'description':'Glass: no fungus. Optical elements: haze present.'})
  self.assertEqual((r['fungus'],r['haze'],r['scratches']),('ABSENT','PRESENT','UNKNOWN'))
  self.assertTrue(all(e['sourceUrl']==r['sourceUrl'] for e in r['listingDetails']['evidence']))
 def test_shipping_does_not_apply_postcode_rate_to_everyone(self):
  r=self.row();enrich(r,BeautifulSoup('','html.parser'),offer={'shippingDetails':{'shippingDestination':{'addressCountry':'IN','postalCode':'110001'},'shippingRate':{'currency':'INR','value':0}}})
  self.assertIsNone(r['shippingPaise'])
 def test_optional_policy_failure_preserves_successful_price_observations(self):
  html='<script type="application/ld+json">'+json.dumps({'@type':'Product','name':'Sony FE 50mm F1.8','offers':{'priceCurrency':'INR','price':20000}})+'</script>'
  def reader(url):
   if url==POLICIES['sony']:raise TimeoutError('policy unavailable')
   return html,AT
  with patch('refresh_sources.SOURCES',[s for s in SOURCES if s[0]=='sony']),patch('refresh_sources.PRODUCTS',{'sony':['https://shopatsc.com/products/lens']}):
   result=refresh({},reader)
  self.assertEqual(result['sources'][0]['status'],'OK');self.assertEqual(result['observations'][0]['pricePaise'],2000000)
  self.assertIn('could not be refreshed',result['sources'][0]['message'])

if __name__=='__main__':unittest.main()
