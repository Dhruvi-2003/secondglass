package in.refurblens.catalog;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ImportService {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final Clock clock;
    private final SellerPolicy sellerPolicy;
    public ImportService(JdbcTemplate db, ObjectMapper json, Clock clock,SellerPolicy sellerPolicy) { this.db=db; this.json=json; this.clock=clock; this.sellerPolicy=sellerPolicy; }
    public record Result(int accepted, int rejected, boolean replayed) {}

    /** A single database lock trades ingestion throughput for straightforward, race-safe pilot imports. */
    @Transactional
    public Result ingest(String batchId, List<SourceObservation> rows) {
        required(batchId,150,"Batch ID");
        if(rows==null || rows.isEmpty() || rows.size()>200) throw new IllegalArgumentException("Import 1–200 observations per batch.");
        var seen=new HashSet<String>();
        for(var row:rows) {
            if(row==null) throw new IllegalArgumentException("An observation is missing.");
            if(!seen.add(row.retailerId()+"\u0000"+row.externalKey())) throw new IllegalArgumentException("A batch contains the same seller listing more than once.");
        }
        String payloadHash=fingerprint(rows);
        db.queryForObject("SELECT id FROM ingest_lock WHERE id=1 FOR UPDATE",Integer.class);
        var previous=db.queryForList("SELECT payload_hash,accepted,rejected FROM import_batch WHERE id=?",batchId);
        if(!previous.isEmpty()) {
            var p=previous.get(0);
            if(!payloadHash.equals(p.get("payload_hash"))) throw new IllegalArgumentException("This batch ID was already used for different data.");
            return new Result(((Number)p.get("accepted")).intValue(),((Number)p.get("rejected")).intValue(),true);
        }
        db.update("INSERT INTO import_batch VALUES(?,?,0,0,?)",batchId,payloadHash,OffsetDateTime.now(clock));
        int accepted=0,rejected=0;
        for(var row:rows) {
            try { validate(row); validateTimestampConflict(row); }
            catch(IllegalArgumentException e) {
                String key=Objects.toString(row.externalKey(),"");
                db.update("INSERT INTO rejected_observation VALUES(?,?,?,?)",UUID.randomUUID().toString(),batchId,key.substring(0,Math.min(120,key.length())),e.getMessage());
                rejected++; continue;
            }
            save(batchId,row); accepted++;
        }
        db.update("UPDATE import_batch SET accepted=?,rejected=? WHERE id=?",accepted,rejected,batchId);
        return new Result(accepted,rejected,false);
    }
    private void validateTimestampConflict(SourceObservation r) {
        var existing=db.queryForList("SELECT obs.payload_hash FROM observation obs JOIN offer o ON o.id=obs.offer_id WHERE o.retailer_id=? AND o.external_key=? AND obs.observed_at=?",r.retailerId(),r.externalKey(),at(r));
        if(!existing.isEmpty() && !fingerprint(r).equals(existing.get(0).get("payload_hash"))) throw new IllegalArgumentException("Conflicting data has the same observation time. Supply a corrected, newer observation.");
    }
    private void validate(SourceObservation r) {
        if(r.listingType()!=null && !Set.of("NEW","USED","REFURBISHED").contains(r.listingType())) throw new IllegalArgumentException("Unknown listing type.");
        if(r.productRating()!=null) {
            var rating=r.productRating();
            if(rating.value()==null || !Double.isFinite(rating.value()) || rating.value()<1 || rating.value()>5 || rating.count()==null || rating.count()<1 || rating.count()>100_000_000 || !Set.of("ratings","reviews").contains(Objects.toString(rating.countType(),""))) throw new IllegalArgumentException("Product rating requires a 1–5 score, positive count and ratings/reviews count type.");
        }
        required(r.retailerId(),80,"Seller ID"); required(r.retailerName(),120,"Seller name"); required(r.externalKey(),120,"Listing ID");
        required(r.brand(),80,"Brand"); required(r.model(),150,"Model"); required(r.conditionLabel(),100,"Condition label"); required(r.conditionNotes(),2000,"Seller condition disclosure");
        optional(r.modelCode(),100,"Model code"); optional(r.mount(),60,"Mount"); optional(r.maxAperture(),30,"Aperture");
        optional(r.warrantyDetails(),1500,"Warranty details"); optional(r.accessories(),500,"Accessories");
        if(r.coverage()!=null && !Set.of("FULL_FRAME","APS_C").contains(r.coverage())) throw new IllegalArgumentException("Coverage must be FULL_FRAME, APS_C or null.");
        range(r.focalMin(),1,2000,"Focal length"); range(r.focalMax(),1,2000,"Focal length");
        if(r.focalMin()!=null&&r.focalMax()!=null&&r.focalMin()>r.focalMax()) throw new IllegalArgumentException("Focal range is reversed.");
        for(String status:Arrays.asList(r.fungus(),r.scratches(),r.haze())) if(!Set.of("ABSENT","PRESENT","UNKNOWN").contains(Objects.toString(status,""))) throw new IllegalArgumentException("Optical disclosures must be ABSENT, PRESENT or UNKNOWN.");
        range(r.warrantyMonths(),0,120,"Warranty"); range(r.returnDays(),0,365,"Return window");
        if(r.pricePaise()==null||r.pricePaise()<10000||r.pricePaise()>100_000_000L) throw new IllegalArgumentException("Price is missing or outside pilot limits.");
        if(r.shippingPaise()!=null&&(r.shippingPaise()<0||r.shippingPaise()>1_000_000)) throw new IllegalArgumentException("Shipping amount is invalid.");
        if(!Set.of("IN_STOCK","OUT_OF_STOCK","BACKORDER","UNKNOWN").contains(Objects.toString(r.availability(),""))) throw new IllegalArgumentException("Stock status is invalid.");
        if(r.observedAt()==null||r.observedAt().isAfter(clock.instant().plusSeconds(60))) throw new IllegalArgumentException("Observation time is missing or in the future.");
        if(!r.demo()&&(r.sourceUrl()==null||r.sourceUrl().isBlank())) throw new IllegalArgumentException("A real offer requires a source URL.");
        if(!r.demo()) sellerPolicy.validate(r.retailerId(),r.sourceUrl());
        if(r.sourceUrl()!=null) {
            optional(r.sourceUrl(),2000,"Source URL");
            try { URI u=URI.create(r.sourceUrl()); if(!"https".equals(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null) throw new IllegalArgumentException(); }
            catch(IllegalArgumentException e) { throw new IllegalArgumentException("Source URL must be an HTTPS link without credentials."); }
        }
    }
    private void save(String batchId,SourceObservation r) {
        // Manufacturer model code, mount and optical details are required before claiming a match.
        boolean complete=r.modelCode()!=null&&r.mount()!=null&&r.coverage()!=null&&r.focalMin()!=null&&r.focalMax()!=null&&r.maxAperture()!=null&&r.autofocus()!=null&&r.stabilized()!=null;
        String key=String.join("|","LENS",normalized(r.brand()),normalized(r.modelCode()),normalized(r.mount()),Objects.toString(r.coverage(),"?"),Objects.toString(r.focalMin(),"?"),Objects.toString(r.focalMax(),"?"),normalized(r.maxAperture()),Objects.toString(r.autofocus(),"?"),Objects.toString(r.stabilized(),"?"));
        String configId=hash(key+(complete?"":"|"+normalized(r.model())+"|"+r.retailerId()+"|"+r.externalKey()));
        if(db.queryForObject("SELECT count(*) FROM retailer WHERE id=?",Integer.class,r.retailerId())==0) db.update("INSERT INTO retailer VALUES(?,?)",r.retailerId(),r.retailerName());
        if(db.queryForObject("SELECT count(*) FROM configuration WHERE id=?",Integer.class,configId)==0)
            db.update("INSERT INTO configuration VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",configId,"LENS",r.brand(),r.model(),r.modelCode(),r.mount(),r.coverage(),r.focalMin(),r.focalMax(),r.maxAperture(),r.autofocus(),r.stabilized(),complete);
        var existing=db.queryForList("SELECT id FROM offer WHERE retailer_id=? AND external_key=?",r.retailerId(),r.externalKey());
        String offerId=existing.isEmpty()?UUID.randomUUID().toString():(String)existing.get(0).get("id");
        if(existing.isEmpty()) {
            db.update("INSERT INTO offer (id,retailer_id,external_key,configuration_id,condition_label,condition_notes,fungus,scratches,haze,accessories,warranty_months,warranty_details,return_days,price_paise,shipping_paise,availability,source_url,observed_at,demo,listing_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",offerId,r.retailerId(),r.externalKey(),configId,r.conditionLabel(),r.conditionNotes(),r.fungus(),r.scratches(),r.haze(),r.accessories(),r.warrantyMonths(),r.warrantyDetails(),r.returnDays(),r.pricePaise(),r.shippingPaise(),r.availability(),r.sourceUrl(),at(r),r.demo(),Objects.toString(r.listingType(),"USED"));
        } else {
            // A delayed observation is retained without moving the catalogue state backwards.
            db.update("UPDATE offer SET configuration_id=?,condition_label=?,condition_notes=?,fungus=?,scratches=?,haze=?,accessories=?,warranty_months=?,warranty_details=?,return_days=?,price_paise=?,shipping_paise=?,availability=?,source_url=?,observed_at=?,demo=?,listing_type=? WHERE id=? AND observed_at < ?",configId,r.conditionLabel(),r.conditionNotes(),r.fungus(),r.scratches(),r.haze(),r.accessories(),r.warrantyMonths(),r.warrantyDetails(),r.returnDays(),r.pricePaise(),r.shippingPaise(),r.availability(),r.sourceUrl(),at(r),r.demo(),Objects.toString(r.listingType(),"USED"),offerId,at(r));
        }
        var rating=r.productRating();
        db.update("UPDATE offer SET product_rating=?,product_rating_count=?,product_rating_count_type=? WHERE id=? AND observed_at=?",rating==null?null:rating.value(),rating==null?null:rating.count(),rating==null?null:rating.countType(),offerId,at(r));
        if(db.queryForObject("SELECT count(*) FROM observation WHERE offer_id=? AND observed_at=?",Integer.class,offerId,at(r))==0)
            db.update("INSERT INTO observation VALUES(?,?,?,?,?,?,?,?)",UUID.randomUUID().toString(),offerId,batchId,configId,r.pricePaise(),r.availability(),at(r),fingerprint(r));
    }
    private static OffsetDateTime at(SourceObservation r) { return OffsetDateTime.ofInstant(r.observedAt(),ZoneOffset.UTC); }
    private String fingerprint(Object object) { try { return hash(json.writeValueAsString(object)); } catch(JsonProcessingException e) { throw new IllegalArgumentException("Cannot read import."); } }
    private static String normalized(String s) { return s==null?"?":s.strip().toLowerCase(Locale.ROOT).replaceAll("\\s+"," "); }
    private static void required(String s,int max,String field) { if(s==null||s.isBlank()||s.length()>max||s.contains("|")||s.indexOf('\0')>=0) throw new IllegalArgumentException(field+" is missing or invalid."); }
    private static void optional(String s,int max,String field) { if(s!=null) required(s,max,field); }
    private static void range(Integer n,int min,int max,String field) { if(n!=null&&(n<min||n>max)) throw new IllegalArgumentException(field+" is outside the supported range."); }
    private static String hash(String s) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8))); } catch(NoSuchAlgorithmException e) { throw new IllegalStateException(e); } }
}
