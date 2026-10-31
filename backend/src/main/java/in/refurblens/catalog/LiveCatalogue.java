package in.refurblens.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;

/** Reloads an atomically written local source snapshot. Never fetches visitor-supplied URLs. */
@Component
@EnableScheduling
@RestController
public class LiveCatalogue implements ApplicationRunner {
    public record Snapshot(String generatedAt,List<Map<String,Object>> sources,List<SourceObservation> observations) {}
    private final ObjectMapper json;
    private final ImportService importer;
    private final JdbcTemplate db;
    private final TransactionTemplate transaction;
    private final String path;
    private final boolean demo;
    private final SellerPolicy sellerPolicy;
    private String loadedHash="";
    private volatile Map<String,Object> status=Map.of("sources",List.of(),"message","No source snapshot loaded.");
    public LiveCatalogue(ObjectMapper json,ImportService importer,JdbcTemplate db,TransactionTemplate transaction,SellerPolicy sellerPolicy,
            @Value("${app.live-data:}") String path,@Value("${app.demo}") boolean demo) {
        this.sellerPolicy=sellerPolicy;this.json=json;this.importer=importer;this.db=db;this.transaction=transaction;this.path=path;this.demo=demo;
    }
    @Override public void run(ApplicationArguments args) throws Exception { if(!demo&&!path.isBlank()) reload(); }
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    public void refresh() {
        if(demo||path.isBlank()) return;
        try { reload(); }
        catch(Exception e) {
            var retained=new LinkedHashMap<>(status);
            retained.put("message","Local catalogue refresh failed; previous observations remain unchanged.");
            status=Collections.unmodifiableMap(retained);
        }
    }
    public synchronized void reload() throws Exception {
        Path file=Path.of(path);
        if(!Files.isRegularFile(file)) { status=Map.of("sources",List.of(),"message","No real source snapshot found. Run tools/refresh_sources.py."); return; }
        if(Files.size(file)>2_000_000) throw new IllegalArgumentException("Snapshot exceeds supported size");
        byte[] bytes=Files.readAllBytes(file);
        String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        if(hash.equals(loadedHash)) return;
        Snapshot snapshot=json.readValue(bytes,Snapshot.class);
        if(snapshot.observations()==null||snapshot.sources()==null||snapshot.generatedAt()==null) throw new IllegalArgumentException("Incomplete snapshot");
        if(snapshot.observations().stream().anyMatch(SourceObservation::demo)) throw new IllegalArgumentException("Live snapshot contains demo data");
        transaction.executeWithoutResult(tx -> {
            var rows=snapshot.observations();
            for(int from=0;from<rows.size();from+=200) {
                var result=importer.ingest("public-"+hash+"-"+from,rows.subList(from,Math.min(from+200,rows.size())));
                if(result.rejected()!=0) throw new IllegalArgumentException("Snapshot contains rejected observations");
            }
            // A removed source must also disappear from existing databases, without deleting history.
            var allowed=sellerPolicy.sourceIds();
            db.update("UPDATE offer SET active=FALSE WHERE demo=FALSE AND retailer_id NOT IN ("+String.join(",",Collections.nCopies(allowed.size(),"?"))+")",allowed.toArray());
            // Hide vanished offers without deleting their history. Failed adapters retain old rows in the file.
            for(var source:snapshot.sources()) {
                String id=Objects.toString(source.get("id"),"");
                db.update("UPDATE offer SET active=FALSE WHERE retailer_id=? AND demo=FALSE",id);
            }
            for(var row:rows) db.update("UPDATE offer SET active=TRUE WHERE retailer_id=? AND external_key=?",row.retailerId(),row.externalKey());
        });
        loadedHash=hash;
        // Only public coverage fields are exposed; collector diagnostics stay in the local file.
        var sources=snapshot.sources().stream().map(source -> {
            var safe=new LinkedHashMap<String,Object>();
            for(String key:List.of("id","name","url","status","checkedAt","lastSuccessAt","offers","scope","message","storeType")) safe.put(key,source.get(key));
            return safe;
        }).toList();
        status=Map.of("sources",sources,"generatedAt",snapshot.generatedAt(),"message","Selected public listings, not complete retailer inventory. Refresh is on demand; observations become stale after 24 hours.");
    }
    @GetMapping("/api/sources") public Map<String,Object> sources() { return demo?Map.of("sources",List.of(),"message","Sample mode; no live source data."):status; }
}
