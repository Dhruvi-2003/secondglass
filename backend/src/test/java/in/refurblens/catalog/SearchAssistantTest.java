package in.refurblens.catalog;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class SearchAssistantTest {
    @Test void noKeySearchParsesIndianBudgetWithoutConfusingMountAndBrand() {
        var f=SearchAssistant.basic("Sony E prime under ₹25,000 for full frame");
        assertThat(f.maxPrice()).isEqualTo(25000);assertThat(f.brand()).isEmpty();assertThat(f.kind()).isEqualTo("prime");assertThat(f.coverage()).isEqualTo("FULL_FRAME");
        assertThat(SearchAssistant.basic("Sigma zoom below 40k").brand()).isEqualTo("Sigma");
        assertThat(SearchAssistant.basic("Sigma zoom below 40k").maxPrice()).isEqualTo(40000);
    }
    @Test void expandedBrandsDoNotConfuseManufacturerWithMount() throws Exception {
        assertThat(SearchAssistant.basic("Tamron for Nikon Z under 50k").brand()).isEqualTo("Tamron");
        assertThat(SearchAssistant.basic("Sigma for Fujifilm X under 60k").brand()).isEqualTo("Sigma");
        assertThat(SearchAssistant.basic("Fujifilm prime under 30k").brand()).isEqualTo("Fujifilm");
        assertThat(SearchAssistant.basic("Nikon lenses under 60k").brand()).isEqualTo("Nikon");
        var s=new SearchAssistant(mock(AiClient.class),mock(UsageService.class),new ObjectMapper(),20);
        assertThat(s.validate("{\"brand\":\"Nikon\"}").brand()).isEqualTo("Nikon");
        assertThat(s.validate("{\"brand\":\"Fujifilm\"}").brand()).isEqualTo("Fujifilm");
    }
    @Test void aiCannotAddInventedPricesOrOutOfRangeFilters() {
        var s=new SearchAssistant(mock(AiClient.class),mock(UsageService.class),new ObjectMapper(),20);
        assertThatThrownBy(()->s.validate("{\"bestOffer\":123}")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->s.validate("{\"maxPrice\":-1}")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->s.validate("{\"maxPrice\":99999999999999}")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->s.validate("{\"brand\":\"invented\"}")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void providerFailureFallsBackWithoutLosingBudget() throws Exception {
        var ai=mock(AiClient.class);var usage=mock(UsageService.class);
        when(ai.enabled()).thenReturn(true);when(usage.reserveAi(20)).thenReturn(true);when(ai.interpret(anyString())).thenThrow(new java.io.IOException());
        var result=new SearchAssistant(ai,usage,new ObjectMapper(),20).interpret("prime below 20k",true);
        assertThat(result.mode()).isEqualTo("basic");assertThat(result.filters().maxPrice()).isEqualTo(20000);assertThat(result.note()).contains("unavailable");
    }
    @Test void noKeyAndNoConsentNeverCallProvider() throws Exception {
        var ai=mock(AiClient.class);var usage=mock(UsageService.class);
        when(ai.enabled()).thenReturn(true);
        new SearchAssistant(ai,usage,new ObjectMapper(),20).interpret("prime below 20k",false);
        verify(ai,never()).interpret(anyString());verifyNoInteractions(usage);
    }
    @Test void exhaustedQuotaAvoidsExternalCall() throws Exception {
        var ai=mock(AiClient.class);var usage=mock(UsageService.class);when(ai.enabled()).thenReturn(true);
        var result=new SearchAssistant(ai,usage,new ObjectMapper(),20).interpret("zoom below 40k",true);
        assertThat(result.note()).contains("limit");verify(ai,never()).interpret(anyString());
    }
}
