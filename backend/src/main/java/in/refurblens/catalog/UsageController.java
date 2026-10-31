package in.refurblens.catalog;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api")
public class UsageController {
    private final UsageService service;
    public UsageController(UsageService service) { this.service=service; }
    public record Event(String event) {}
    @PostMapping("/events")
    public Map<String,Boolean> event(@RequestBody Event request) { service.count(request.event()); return Map.of("accepted",true); }
}
