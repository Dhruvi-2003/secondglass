package in.refurblens.catalog;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import java.util.regex.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SearchAssistant {
    public record Filters(String q,String brand,String coverage,String kind,Integer maxPrice,boolean disclosedClearOnly) {}
    public record Result(Filters filters,String mode,String note) {}
    private final AiClient ai;
    private final UsageService usage;
    private final ObjectMapper json;
    private final int dailyLimit;
    public SearchAssistant(AiClient ai,UsageService usage,ObjectMapper json,@Value("${app.ai.daily-limit}") int dailyLimit) { this.ai=ai; this.usage=usage; this.json=json; this.dailyLimit=dailyLimit; }
    public boolean configured() { return ai.enabled(); }
    public Result interpret(String text,boolean useAi) {
        if(text==null||text.isBlank()||text.length()>500) throw new IllegalArgumentException("Describe your search in 1–500 characters.");
        String note="Basic parser: budget, brand, prime/zoom, coverage and focal-length keywords only. Review before applying; other requirements may be ignored.";
        if(useAi&&ai.enabled()) {
            if(usage.reserveAi(dailyLimit)) {
                try { return new Result(validate(ai.interpret(text)),"ai","AI suggested filters only. Check them before applying; compatibility and condition must be reviewed in the listing."); }
                catch(InterruptedException e) { Thread.currentThread().interrupt(); note="AI was interrupted. Basic filters are shown instead; review them before applying."; }
                catch(Exception e) { note="AI was unavailable or returned invalid filters. Basic filters are shown instead; review them before applying."; }
            } else note="The daily AI request limit has been reached. Basic filters are shown instead; review them before applying.";
        }
        return new Result(basic(text),"basic",note);
    }
    Filters validate(String value) throws Exception {
        JsonNode node=json.readTree(value);
        if(node==null||!node.isObject()) throw new IllegalArgumentException("Expected filter object.");
        Set<String> allowed=Set.of("q","brand","coverage","kind","maxPrice","disclosedClearOnly");
        node.fieldNames().forEachRemaining(k->{if(!allowed.contains(k)) throw new IllegalArgumentException("Unexpected filter.");});
        for(String k:List.of("q","brand","coverage","kind")) if(node.has(k)&&!node.get(k).isTextual()) throw new IllegalArgumentException("Invalid filter type.");
        if(node.hasNonNull("maxPrice")&&(!node.get("maxPrice").isIntegralNumber()||!node.get("maxPrice").canConvertToInt())) throw new IllegalArgumentException("Invalid budget.");
        if(node.has("disclosedClearOnly")&&!node.get("disclosedClearOnly").isBoolean()) throw new IllegalArgumentException("Invalid condition filter.");
        String q=node.path("q").asText(""),brand=node.path("brand").asText(""),coverage=node.path("coverage").asText(""),kind=node.path("kind").asText("");
        Integer budget=node.hasNonNull("maxPrice")?node.get("maxPrice").asInt():null;
        if(q.length()>100||!Set.of("","Sigma","Tamron","Sony","Canon","Nikon","Fujifilm").contains(brand)||!Set.of("","FULL_FRAME","APS_C").contains(coverage)||!Set.of("","prime","zoom").contains(kind)||budget!=null&&(budget<100||budget>1000000)) throw new IllegalArgumentException("Unsupported filters.");
        return new Filters(q,brand,coverage,kind,budget,node.path("disclosedClearOnly").asBoolean(false));
    }
    static Filters basic(String input) {
        String text=input.toLowerCase(Locale.ROOT).replace('₹',' ').replace(",","");
        Integer budget=null;
        var money=Pattern.compile("(?:under|below|up to|upto|budget(?: of)?|less than)\\s*(?:rs\\.?|inr)?\\s*(\\d+(?:\\.\\d+)?)\\s*(k|lakh)?\\b").matcher(text);
        if(money.find()) { double n=Double.parseDouble(money.group(1))*("k".equals(money.group(2))?1000:"lakh".equals(money.group(2))?100000:1); if(n>=100&&n<=1000000) budget=(int)n; }
        String brand="",brandText=text.replaceAll("(?:sony\\s+e|nikon\\s+z|fujifilm\\s+x|canon\\s+(?:rf-s|ef-s|rf|ef))(?:-mount| mount)?","");
        for(String b:List.of("Sigma","Tamron","Sony","Canon","Nikon","Fujifilm")) if(Pattern.compile("\\b"+b.toLowerCase(Locale.ROOT)+"\\b").matcher(brandText).find()) { brand=b; break; }
        String coverage=text.matches(".*\\b(full[ -]?frame)\\b.*")?"FULL_FRAME":text.matches(".*\\b(aps[ -]?c|crop sensor)\\b.*")?"APS_C":"";
        String kind=text.matches(".*\\bprime\\b.*")?"prime":text.matches(".*\\bzoom\\b.*")?"zoom":"";
        var focal=Pattern.compile("\\b(\\d+(?:[-–]\\d+)?)\\s*mm\\b").matcher(text);
        String q=focal.find()?focal.group(1).replace('-','–')+"mm":"";
        boolean clear=text.contains("no optical defects")||text.contains("clear optics");
        return new Filters(q,brand,coverage,kind,budget,clear);
    }
}
