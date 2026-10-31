package in.refurblens.catalog;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/search")
public class SearchController {
    private final SearchAssistant assistant;
    public SearchController(SearchAssistant assistant) { this.assistant=assistant; }
    public record Query(String text,boolean useAi) {}
    @GetMapping("/capabilities")
    public Map<String,Object> capabilities() { return Map.of("aiConfigured",assistant.configured(),"basicAvailable",true); }
    @PostMapping("/interpret")
    public SearchAssistant.Result interpret(@RequestBody Query query) { return assistant.interpret(query.text(),query.useAi()); }
}
