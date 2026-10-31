package in.refurblens.catalog;
import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
class SellerPolicyTest {
 @Test void excludesPersonToPersonSources() throws Exception {
  var policy=new SellerPolicy(new ObjectMapper());
  for(String source:new String[]{"olx","facebook","quikr","techenclave","tapprs"})
   assertThatThrownBy(()->policy.validate(source,"https://example.com/item")).isInstanceOf(IllegalArgumentException.class);
 }
 @Test void rejectsUnreviewedDestinationsEvenWithRetailerId() throws Exception {
  var policy=new SellerPolicy(new ObjectMapper());
  for(String url:new String[]{"https://www.olx.in/item/1","https://www.amazon.in.attacker.example/dp/1","https://www.amazon.in@attacker.example/dp/1","http://www.amazon.in/dp/1"})
   assertThatThrownBy(()->policy.validate("amazon",url)).isInstanceOf(IllegalArgumentException.class);
 }
 @Test void acceptsReviewedRetailCheckoutDestinations() throws Exception {
  var policy=new SellerPolicy(new ObjectMapper());
  assertThatCode(()->policy.validate("cashify","https://www.cashify.in/buy-refurbished-camera-lens/item")).doesNotThrowAnyException();
  assertThatCode(()->policy.validate("amazon","https://www.amazon.in/dp/ASIN")).doesNotThrowAnyException();
 }
}
