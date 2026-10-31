package in.refurblens.catalog;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class CatalogController {
    private final com.fasterxml.jackson.databind.ObjectMapper json;
    private final JdbcTemplate db;
    private final Clock clock;
    private final ImportService importer;
    private final String adminToken;
    private final long freshHours;
    private final boolean demo;
    public CatalogController(JdbcTemplate db,Clock clock,ImportService importer,com.fasterxml.jackson.databind.ObjectMapper json,
            @Value("${app.admin-token}") String token,@Value("${app.fresh-hours}") long hours,@Value("${app.demo}") boolean demo) {
        this.json=json; this.db=db; this.clock=clock; this.importer=importer; this.adminToken=token; this.freshHours=hours; this.demo=demo;
    }
    private static final String FROM=" FROM offer o JOIN retailer r ON r.id=o.retailer_id JOIN configuration c ON c.id=o.configuration_id ";
    private static final String SELECT="SELECT o.*,r.name AS seller,c.brand,c.model,c.model_code,c.mount,c.coverage,c.focal_min,c.focal_max,c.max_aperture,c.autofocus,c.stabilized,c.complete"+FROM;

    @GetMapping("/catalog")
    public Map<String,Object> catalog(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="1000000") long maxPrice,
            @RequestParam(defaultValue="") String brand,@RequestParam(defaultValue="") String coverage,@RequestParam(defaultValue="") String kind,
            @RequestParam(defaultValue="false") boolean freshOnly,@RequestParam(defaultValue="false") boolean inStockOnly,
            @RequestParam(defaultValue="false") boolean includeSoldOut,@RequestParam(defaultValue="false") boolean disclosedClearOnly,@RequestParam(defaultValue="price") String sort,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="12") int size,@RequestParam(defaultValue="") String ids,@RequestParam(defaultValue="") String retailer,@RequestParam(defaultValue="") String listingType,@RequestParam(defaultValue="") String mount) {
        if(q.length()>100||brand.length()>80||maxPrice<0||maxPrice>1_000_000||page<0||page>1000||size<1||size>48) throw new IllegalArgumentException("Filter values are outside supported limits.");
        if(!Set.of("","FULL_FRAME","APS_C").contains(coverage)||!Set.of("","prime","zoom").contains(kind)) throw new IllegalArgumentException("Unknown lens filter.");
        var args=new ArrayList<Object>();
        var where=new StringBuilder("WHERE o.active=TRUE AND o.price_paise <= ? "); args.add(maxPrice*100);
        if(mount.length()>60 || retailer.length()>80 || !Set.of("","NEW","USED","REFURBISHED").contains(listingType)) throw new IllegalArgumentException("Unknown source filter.");
        if(!retailer.isBlank()) { where.append("AND o.retailer_id=? "); args.add(retailer); }
        if(!listingType.isBlank()) { where.append("AND o.listing_type=? "); args.add(listingType); }
        if(!mount.isBlank()) { where.append("AND lower(c.mount)=? "); args.add(mount.toLowerCase(Locale.ROOT)); }
        // Every word must match, with SQL wildcard characters treated literally.
        for(String term:q.replace('–','-').strip().split("\\s+")) if(!term.isBlank()) {
            where.append("AND replace(lower(c.brand || ' ' || c.model || ' ' || coalesce(c.model_code,'') || ' ' || coalesce(c.mount,'')),'–','-') LIKE ? ESCAPE '!' ");
            args.add("%"+term.toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_")+"%");
        }
        if(!brand.isBlank()) { where.append("AND lower(c.brand)=? "); args.add(brand.toLowerCase(Locale.ROOT)); }
        if(!coverage.isBlank()) { where.append("AND c.coverage=? "); args.add(coverage); }
        if(kind.equals("prime")) where.append("AND c.focal_min=c.focal_max ");
        if(kind.equals("zoom")) where.append("AND c.focal_min<c.focal_max ");
        if(freshOnly) { where.append("AND o.observed_at >= ? "); args.add(OffsetDateTime.now(clock).minusHours(freshHours)); }
        if(!includeSoldOut) where.append("AND o.availability<>'OUT_OF_STOCK' ");
        if(inStockOnly) where.append("AND o.availability='IN_STOCK' ");
        if(disclosedClearOnly) where.append("AND o.fungus='ABSENT' AND o.scratches='ABSENT' AND o.haze='ABSENT' ");
        if(!ids.isBlank()) {
            var list=Arrays.asList(ids.split(",",-1));
            if(list.size()>100||list.stream().anyMatch(id->!id.matches("[a-zA-Z0-9-]{1,36}"))) throw new IllegalArgumentException("Invalid shortlist.");
            where.append("AND o.id IN ("+String.join(",",Collections.nCopies(list.size(),"?"))+") "); args.addAll(list);
        }
        String order=switch(sort) { case "recent" -> "o.observed_at DESC"; case "price" -> "CASE WHEN o.availability='OUT_OF_STOCK' THEN 1 ELSE 0 END,o.price_paise ASC"; case "price-desc" -> "o.price_paise DESC"; default -> throw new IllegalArgumentException("Unknown sort option."); };
        int total=db.queryForObject("SELECT count(*)"+FROM+where,Integer.class,args.toArray());
        args.add(size); args.add(page*size);
        var offers=db.queryForList(SELECT+where+"ORDER BY "+order+",o.id LIMIT ? OFFSET ?",args.toArray()).stream().map(this::decorate).toList();
        return Map.of("offers",offers,"demo",demo,"freshHours",freshHours,"total",total,"page",page,"size",size);
    }
    private Map<String,Object> decorate(Map<String,Object> row) {
        var raw=row.get("listing_details");
        if(raw!=null) {
            try { row.put("listing_details",json.readValue(raw.toString(),SourceObservation.ListingDetails.class)); }
            catch(com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException("Stored listing details are invalid.",e); }
        }
        Instant at=observedInstant(row.get("observed_at"));
        row.put("stale",at.isBefore(clock.instant().minus(Duration.ofHours(freshHours)))); row.put("observed_at",at.toString());
        return row;
    }
    private static Instant observedInstant(Object value) {
        if(value instanceof OffsetDateTime time) return time.toInstant();
        if(value instanceof java.sql.Timestamp time) return time.toInstant();
        if(value instanceof Instant time) return time;
        throw new IllegalStateException("Unsupported database timestamp representation.");
    }
    @GetMapping("/offers/{id}")
    public Map<String,Object> offer(@PathVariable String id) {
        var rows=db.queryForList(SELECT+"WHERE o.id=? AND o.active=TRUE",id);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Offer not found");
        return decorate(rows.get(0));
    }
    @GetMapping("/offers/{id}/history")
    public Map<String,Object> history(@PathVariable String id) {
        var offer=offer(id);
        var points=db.queryForList("SELECT price_paise,availability,observed_at FROM observation WHERE offer_id=? AND configuration_id=? ORDER BY observed_at",id,offer.get("configuration_id"));
        points.forEach(point->point.put("observed_at",observedInstant(point.get("observed_at")).toString()));
        return Map.of("points",points,"demo",offer.get("demo"),"scope","This source listing and current lens variant. Marketplace sellers may change; condition variants are not individual physical units.");
    }
    @GetMapping("/compare")
    public Map<String,Object> compare(@RequestParam List<String> ids) {
        if(ids.size()<2||ids.size()>3||new HashSet<>(ids).size()!=ids.size()) throw new IllegalArgumentException("Choose 2 or 3 different offers.");
        var offers=ids.stream().map(this::offer).toList();
        boolean incomplete=offers.stream().anyMatch(o->!Boolean.TRUE.equals(o.get("complete")));
        boolean equal=!incomplete&&offers.stream().map(o->o.get("configuration_id")).distinct().count()==1;
        return Map.of("offers",offers,"modelMatch",equal?"MATCHING_VARIANT":incomplete?"INSUFFICIENT_INFORMATION":"DIFFERENT_VARIANTS",
            "notice","New and used offers are different purchase options. A matching lens model does not mean equivalent physical condition. Optical disclosures and grades are seller claims, not independent inspections.");
    }
    @GetMapping("/health")
    public Map<String,Object> health() {
        return Map.of("status","UP","demo",demo,"offers",db.queryForObject("SELECT count(*) FROM offer",Integer.class));
    }
    public record ImportRequest(String batchId,List<SourceObservation> observations) {}
    @PostMapping("/admin/import")
    public ImportService.Result ingest(@RequestHeader(value="Authorization",defaultValue="") String auth,@RequestBody ImportRequest request) {
        authorize(auth);
        if(!demo && request.observations()!=null && request.observations().stream().anyMatch(r -> r!=null && r.demo())) throw new IllegalArgumentException("Demo offers cannot be submitted to the live catalogue.");
        return importer.ingest(request.batchId(),request.observations());
    }
    @GetMapping("/admin/summary")
    public Map<String,Object> summary(@RequestHeader(value="Authorization",defaultValue="") String auth) {
        authorize(auth);
        return Map.of("batches",db.queryForList("SELECT id,accepted,rejected,created_at FROM import_batch ORDER BY created_at DESC LIMIT 30"),
            "rejections",db.queryForList("SELECT batch_id,external_key,reason FROM rejected_observation LIMIT 100"),
            "usage",db.queryForList("SELECT * FROM usage_count ORDER BY event_day DESC LIMIT 90"));
    }
    private void authorize(String auth) {
        if(adminToken.isBlank()||!MessageDigest.isEqual(auth.getBytes(StandardCharsets.UTF_8),("Bearer "+adminToken).getBytes(StandardCharsets.UTF_8))) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Owner access required");
    }
}
