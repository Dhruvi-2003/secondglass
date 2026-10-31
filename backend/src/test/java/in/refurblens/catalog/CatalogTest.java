package in.refurblens.catalog;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties={"app.demo=false","app.live-data=","app.admin-token=","spring.datasource.url=jdbc:h2:mem:tests;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"})
@AutoConfigureMockMvc
class CatalogTest {
    @Autowired ImportService importer;
    @Autowired JdbcTemplate db;
    @Autowired MockMvc http;
    @Autowired UsageService usage;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
    Instant now;
    @BeforeEach void clear() {
        for(String table:List.of("observation","rejected_observation","import_batch","offer","configuration","retailer","usage_count","ai_usage")) db.update("DELETE FROM "+table);
        now=Instant.now().minusSeconds(120);
    }
    SourceObservation row(String seller,String listing,String code,String mount,long price,Instant at) {
        return new SourceObservation(seller,"Sample "+seller,listing,"Sony","FE 50mm F1.8",code,mount,"FULL_FRAME",50,50,"1.8",true,false,"Good","Seller reports clean glass.","ABSENT","ABSENT","ABSENT","Both caps",3,"Mechanical faults only",7,price,null,"IN_STOCK",null,at,true);
    }
    int count(String table) { return db.queryForObject("SELECT count(*) FROM "+table,Integer.class); }
    @Test void sameBatchReplayDoesNotDuplicateObservations() {
        var rows=List.of(row("a","one","SEL50F18F","Sony E",1290000,now));
        assertThat(importer.ingest("batch",rows).replayed()).isFalse();
        assertThat(importer.ingest("batch",rows).replayed()).isTrue();
        assertThat(count("observation")).isEqualTo(1);
    }
    @Test void concurrentReplayIsSerializedAtTheDatabase() throws Exception {
        var rows=List.of(row("a","one","SEL50F18F","Sony E",1290000,now));
        var executor=Executors.newFixedThreadPool(2);
        try {
            var gate=new CountDownLatch(1);
            Callable<ImportService.Result> call=()->{gate.await();return importer.ingest("concurrent",rows);};
            var a=executor.submit(call);var b=executor.submit(call);gate.countDown();
            assertThat(List.of(a.get(10,TimeUnit.SECONDS).replayed(),b.get(10,TimeUnit.SECONDS).replayed())).containsExactlyInAnyOrder(false,true);
            assertThat(count("observation")).isEqualTo(1);
        } finally { executor.shutdownNow(); }
    }
    @Test void reusingBatchIdForDifferentDataIsRejected() {
        importer.ingest("batch",List.of(row("a","one","SEL50F18F","Sony E",1290000,now)));
        assertThatThrownBy(()->importer.ingest("batch",List.of(row("a","one","SEL50F18F","Sony E",1390000,now)))).isInstanceOf(IllegalArgumentException.class);
        assertThat(count("observation")).isEqualTo(1);
    }
    @Test void sameTimestampConflictIsQuarantinedAndExactRepeatIsDeduplicated() {
        var rows=List.of(row("a","one","SEL50F18F","Sony E",1290000,now));
        importer.ingest("first",rows); importer.ingest("repeat-new-batch",rows);
        var result=importer.ingest("conflicting",List.of(row("a","one","SEL50F18F","Sony E",1190000,now)));
        assertThat(result.rejected()).isEqualTo(1);
        assertThat(count("observation")).isEqualTo(1);
        assertThat(db.queryForObject("SELECT price_paise FROM offer",Long.class)).isEqualTo(1290000L);
    }
    @Test void differentMountsNeverBecomeTheSameVariant() {
        importer.ingest("batch",List.of(row("a","one","model-code","Sony E",1290000,now),row("b","two","model-code","Nikon Z",1290000,now)));
        assertThat(count("configuration")).isEqualTo(2);
    }
    @Test void differentModelCodesNeverBecomeTheSameVariant() throws Exception {
        importer.ingest("batch",List.of(row("a","one","SEL50F18F","Sony E",1290000,now),row("b","two","SEL50F18","Sony E",1490000,now)));
        var ids=db.queryForList("SELECT id FROM offer",String.class);
        http.perform(get("/api/compare").param("ids",String.join(",",ids))).andExpect(jsonPath("$.modelMatch").value("DIFFERENT_VARIANTS"));
    }
    @Test void normalizedModelCodesCanMatchAcrossSellers() throws Exception {
        importer.ingest("batch",List.of(row("a","one","SEL50F18F","Sony E",1290000,now),row("b","two","sel50f18f","sony e",1390000,now)));
        assertThat(count("configuration")).isEqualTo(1);
        var ids=db.queryForList("SELECT id FROM offer",String.class);
        http.perform(get("/api/compare").param("ids",String.join(",",ids))).andExpect(jsonPath("$.modelMatch").value("MATCHING_VARIANT"));
    }
    @Test void missingCodePreventsCrossSellerMatch() throws Exception {
        importer.ingest("batch",List.of(row("a","one",null,"Sony E",1290000,now),row("b","two",null,"Sony E",1390000,now)));
        assertThat(count("configuration")).isEqualTo(2);
        var ids=db.queryForList("SELECT id FROM offer",String.class);
        http.perform(get("/api/compare").param("ids",String.join(",",ids))).andExpect(jsonPath("$.modelMatch").value("INSUFFICIENT_INFORMATION"));
    }
    @Test void lateObservationCannotReplaceNewerPrice() {
        importer.ingest("newer",List.of(row("a","one","SEL50F18F","Sony E",1290000,now)));
        importer.ingest("older",List.of(row("a","one","SEL50F18F","Sony E",1190000,now.minusSeconds(86400))));
        assertThat(db.queryForObject("SELECT price_paise FROM offer",Long.class)).isEqualTo(1290000L);
        assertThat(count("observation")).isEqualTo(2);
    }
    @Test void invalidPriceIsQuarantinedAndCorrectedDataCanBeReimported() {
        var result=importer.ingest("broken",List.of(row("a","one","SEL50F18F","Sony E",-500,now),row("a","two","SEL50F18F","Sony E",1290000,now)));
        assertThat(result.accepted()).isEqualTo(1);assertThat(result.rejected()).isEqualTo(1);
        importer.ingest("corrected",List.of(row("a","one","SEL50F18F","Sony E",1190000,now)));
        assertThat(count("offer")).isEqualTo(2);assertThat(count("rejected_observation")).isEqualTo(1);
    }
    @Test void duplicateListingInOneBatchRejectsWithoutPartialWrites() {
        var rows=List.of(row("a","one","SEL50F18F","Sony E",1290000,now),row("a","one","SEL50F18F","Sony E",1390000,now));
        assertThatThrownBy(()->importer.ingest("duplicate",rows)).isInstanceOf(IllegalArgumentException.class);
        assertThat(count("offer")).isZero();assertThat(count("import_batch")).isZero();
    }
    @Test void priceHistorySeparatesChangedVariants() throws Exception {
        importer.ingest("old",List.of(row("a","one","SEL50F18","Sony E",1490000,now.minusSeconds(100))));
        importer.ingest("new",List.of(row("a","one","SEL50F18F","Sony E",1290000,now)));
        String id=db.queryForObject("SELECT id FROM offer",String.class);
        http.perform(get("/api/offers/"+id+"/history")).andExpect(status().isOk()).andExpect(jsonPath("$.points.length()").value(1)).andExpect(jsonPath("$.points[0].price_paise").value(1290000));
    }
    @Test void failedImportDoesNotRefreshExistingTimestamp() throws Exception {
        importer.ingest("old",List.of(row("a","one","SEL50F18F","Sony E",1290000,now.minusSeconds(172800))));
        importer.ingest("failed",List.of(row("a","one","SEL50F18F","Sony E",-1,now)));
        http.perform(get("/api/catalog")).andExpect(jsonPath("$.offers[0].stale").value(true));
        http.perform(get("/api/catalog").param("freshOnly","true")).andExpect(jsonPath("$.total").value(0));
    }
    @Test void filtersAreLiteralAndPaginationCountsWholeResult() throws Exception {
        importer.ingest("batch",List.of(row("a","one","SEL50F18F","Sony E",1290000,now),row("a","two","SEL50F18F","Sony E",1390000,now)));
        http.perform(get("/api/catalog").param("q","%")).andExpect(jsonPath("$.total").value(0));
        http.perform(get("/api/catalog").param("q","Sony 50mm").param("size","1")).andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.offers.length()").value(1));
        http.perform(get("/api/catalog").param("maxPrice","12000")).andExpect(jsonPath("$.total").value(0));
    }
    @Test void unknownOpticsAreNotReturnedByClearDisclosureFilter() throws Exception {
        importer.ingest("batch",List.of(row("a","one","SEL50F18F","Sony E",1290000,now)));
        db.update("UPDATE offer SET fungus='UNKNOWN'");
        http.perform(get("/api/catalog").param("disclosedClearOnly","true")).andExpect(jsonPath("$.total").value(0));
    }
    @Test void soldAndUnknownStockAreExcludedByInStockFilter() throws Exception {
        importer.ingest("batch",List.of(row("a","one","SEL50F18F","Sony E",1290000,now)));
        db.update("UPDATE offer SET availability='OUT_OF_STOCK'");
        http.perform(get("/api/catalog")).andExpect(jsonPath("$.total").value(0));
        http.perform(get("/api/catalog").param("includeSoldOut","true")).andExpect(jsonPath("$.total").value(1));
        http.perform(get("/api/catalog").param("includeSoldOut","true").param("inStockOnly","true")).andExpect(jsonPath("$.total").value(0));
        http.perform(get("/api/catalog").param("inStockOnly","true")).andExpect(jsonPath("$.total").value(0));
        db.update("UPDATE offer SET availability='UNKNOWN'");
        http.perform(get("/api/catalog")).andExpect(jsonPath("$.total").value(1));
        http.perform(get("/api/catalog").param("inStockOnly","true")).andExpect(jsonPath("$.total").value(0));
    }
    @Test void backordersImportButNeverPassInStockFilter() throws Exception {
        var payload=json.valueToTree(row("a","backorder","SEL50F18F","Sony E",1290000,now));
        ((com.fasterxml.jackson.databind.node.ObjectNode)payload).put("availability","BACKORDER");
        var result=importer.ingest("backorder",List.of(json.treeToValue(payload,SourceObservation.class)));
        assertThat(result.rejected()).isZero();
        http.perform(get("/api/catalog")).andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.offers[0].availability").value("BACKORDER"));
        http.perform(get("/api/catalog").param("inStockOnly","true")).andExpect(jsonPath("$.total").value(0));
    }
    @Test void importAndSummaryApisAreClosedWithoutToken() throws Exception {
        http.perform(post("/api/admin/import").contentType("application/json").content("{\"batchId\":\"x\",\"observations\":[]}")).andExpect(status().isUnauthorized());
        http.perform(get("/api/admin/summary")).andExpect(status().isUnauthorized());
    }
    @Test void anonymousCountsAcceptOnlyKnownEventsAndNoExtraFields() throws Exception {
        http.perform(post("/api/events").contentType("application/json").content("{\"event\":\"feedback_helpful\"}")).andExpect(status().isOk());
        http.perform(post("/api/events").contentType("application/json").content("{\"event\":\"anything\"}")).andExpect(status().isBadRequest());
        http.perform(post("/api/events").contentType("application/json").content("{\"event\":\"page_view\",\"email\":\"private@example.com\"}")).andExpect(status().isBadRequest());
        assertThat(count("usage_count")).isEqualTo(1);
    }
    @Test void aiQuotaReservationNeverExceedsLimitUnderConcurrency() throws Exception {
        var executor=Executors.newFixedThreadPool(4);
        try {
            var tasks=new ArrayList<Callable<Boolean>>(); for(int i=0;i<10;i++) tasks.add(()->usage.reserveAi(3));
            int accepted=0;for(var f:executor.invokeAll(tasks)) if(f.get()) accepted++;
            assertThat(accepted).isEqualTo(3);
        } finally { executor.shutdownNow(); }
    }
    @Test void mountFilterSeparatesCanonFromSony() throws Exception {
        importer.ingest("mounts",List.of(row("a","sony","one","Sony E",1290000,now),row("b","canon","two","Canon EF-S",699900,now)));
        http.perform(get("/api/catalog").param("mount","Canon EF-S"))
            .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.offers[0].mount").value("Canon EF-S"));
    }
    @Test void inactiveListingCannotBeOpenedOrCompared() throws Exception {
        importer.ingest("hidden",List.of(row("a","one","one","Sony E",1290000,now)));
        String id=db.queryForObject("SELECT id FROM offer",String.class);
        db.update("UPDATE offer SET active=FALSE");
        http.perform(get("/api/offers/"+id)).andExpect(status().isNotFound());
        http.perform(get("/api/compare").param("ids",id+",missing-offer")).andExpect(status().isNotFound());
    }

    SourceObservation rated(SourceObservation row,double value,int count,String kind) {
        var data=json.convertValue(row,new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>() {});
        data.put("productRating",Map.of("value",value,"count",count,"countType",kind));
        return json.convertValue(data,SourceObservation.class);
    }
    @Test void productRatingRoundTripsWithCountAndSource() throws Exception {
        importer.ingest("rating",List.of(rated(row("a","one","SEL50F18F","Sony E",1290000,now),4.5,580,"ratings")));
        http.perform(get("/api/catalog")).andExpect(jsonPath("$.offers[0].product_rating").value(4.5))
            .andExpect(jsonPath("$.offers[0].product_rating_count").value(580))
            .andExpect(jsonPath("$.offers[0].product_rating_count_type").value("ratings"))
            .andExpect(jsonPath("$.offers[0].seller").value("Sample a"));
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(longs={123456789L,999999999L})
    void nanosecondObservationsRetainRatingsAndReplaySafely(long nanos) {
        var at=now.truncatedTo(java.time.temporal.ChronoUnit.SECONDS).plusNanos(nanos);
        var original=rated(row("a","one","SEL50F18F","Sony E",1290000,at),4.5,580,"ratings");
        importer.ingest("nano-first",List.of(original));
        importer.ingest("nano-repeat",List.of(original));
        assertThat(count("observation")).isEqualTo(1);
        assertThat(db.queryForObject("SELECT product_rating_count FROM offer",Integer.class)).isEqualTo(580);
        assertThat(db.queryForObject("SELECT observed_at FROM offer",java.time.OffsetDateTime.class).toInstant())
            .isEqualTo(at.truncatedTo(java.time.temporal.ChronoUnit.MICROS));
        var collision=rated(row("a","one","SEL50F18F","Sony E",1190000,at.minusNanos(1)),2,10,"reviews");
        assertThat(importer.ingest("nano-conflict",List.of(collision)).rejected()).isEqualTo(1);
        assertThat(count("observation")).isEqualTo(1);
        assertThat(db.queryForObject("SELECT price_paise FROM offer",Long.class)).isEqualTo(1290000L);
        assertThat(db.queryForObject("SELECT product_rating_count FROM offer",Integer.class)).isEqualTo(580);
    }
    @Test void invalidRatingsAreQuarantined() {
        var row=row("a","one","SEL50F18F","Sony E",1290000,now);
        assertThat(importer.ingest("bad-score",List.of(rated(row,5.1,10,"ratings"))).rejected()).isEqualTo(1);
        assertThat(importer.ingest("bad-count",List.of(rated(row,4.5,0,"ratings"))).rejected()).isEqualTo(1);
        assertThat(importer.ingest("bad-kind",List.of(rated(row,4.5,10,"seller"))).rejected()).isEqualTo(1);
        assertThat(count("offer")).isZero();
    }
    @Test void lateRatingCannotOverwriteLatestAndNewMissingRatingClearsIt() {
        importer.ingest("new-rating",List.of(rated(row("a","one","SEL50F18F","Sony E",1290000,now),4.5,580,"ratings")));
        importer.ingest("old-rating",List.of(rated(row("a","one","SEL50F18F","Sony E",1290000,now.minusSeconds(60)),2,10,"reviews")));
        assertThat(db.queryForObject("SELECT product_rating_count FROM offer",Integer.class)).isEqualTo(580);
        importer.ingest("missing-rating",List.of(row("a","one","SEL50F18F","Sony E",1290000,now.plusSeconds(60))));
        assertThat(db.queryForObject("SELECT product_rating FROM offer",Double.class)).isNull();
        assertThat(db.queryForObject("SELECT product_rating_count FROM offer",Integer.class)).isNull();
    }
    @Test void missingRatingsPreserveLegacyPayloadFingerprint() throws Exception {
        var original=row("a","one","SEL50F18F","Sony E",1290000,now);
        String legacy=json.writeValueAsString(original);
        assertThat(legacy).doesNotContain("productRating");
        var parsed=json.readValue(legacy,SourceObservation.class);
        assertThat(parsed.productRating()).isNull();
        importer.ingest("legacy-replay",List.of(original));
        assertThat(importer.ingest("legacy-replay",List.of(parsed)).replayed()).isTrue();
    }

    SourceObservation detailed(Instant at,String policy,String evidenceUrl) {
        var data=json.convertValue(row("pooja","detail-one","SEL50F18F","Sony E",1290000,at),new com.fasterxml.jackson.core.type.TypeReference<Map<String,Object>>() {});
        data.put("listingDetails",Map.of("warrantyType","MANUFACTURER","returnPolicy",policy,
            "returnDetails","Opened lenses excluded; approval required.","ratingStatus","UNAVAILABLE",
            "evidence",List.of(Map.of("field","returns","text","Opened lenses excluded.","sourceUrl",evidenceUrl,"scope","STORE_POLICY"))));
        return json.convertValue(data,SourceObservation.class);
    }
    @Test void listingEvidenceSurvivesImportApiComparisonAndDelayedUpdates() throws Exception {
        var url="https://poojaelectronics.in/refund-and-cancellation-policy/";
        assertThat(importer.ingest("details-now",List.of(detailed(now,"RESTRICTED",url))).accepted()).isEqualTo(1);
        http.perform(get("/api/catalog")).andExpect(status().isOk())
            .andExpect(jsonPath("$.offers[0].listing_details.returnPolicy").value("RESTRICTED"))
            .andExpect(jsonPath("$.offers[0].listing_details.evidence[0].sourceUrl").value(url))
            .andExpect(jsonPath("$.offers[0].listing_details.evidence[0].scope").value("STORE_POLICY"));
        importer.ingest("details-old",List.of(detailed(now.minusSeconds(60),"NO_RETURNS",url)));
        http.perform(get("/api/catalog")).andExpect(jsonPath("$.offers[0].listing_details.returnPolicy").value("RESTRICTED"));
        importer.ingest("details-gone",List.of(row("pooja","detail-one","SEL50F18F","Sony E",1290000,now.plusSeconds(60))));
        assertThat(db.queryForObject("SELECT listing_details FROM offer",String.class)).isNull();
    }
    @Test void unsupportedEvidenceDestinationsAndStatusesAreRejected() {
        assertThat(importer.ingest("bad-evidence-host",List.of(detailed(now,"RESTRICTED","https://evil.example/policy"))).rejected()).isEqualTo(1);
        assertThat(importer.ingest("bad-evidence-status",List.of(detailed(now,"GUARANTEED","https://poojaelectronics.in/policy"))).rejected()).isEqualTo(1);
        assertThat(count("offer")).isZero();
    }

    @Test void groupedResultsKeepEveryExactOfferTogetherBeforePagination() throws Exception {
        importer.ingest("groups",List.of(row("a","one","SEL50F18F","Sony E",1290000,now),
            row("b","two","SEL50F18F","Sony E",1390000,now),row("c","three","SEL50F18F","Sony E",1090000,now),
            row("d","four","SEL50F18F","Nikon Z",1590000,now),row("e","five",null,"Sony E",1790000,now)));
        http.perform(get("/api/catalog").param("grouped","true").param("size","1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(3)).andExpect(jsonPath("$.totalOffers").value(5))
            .andExpect(jsonPath("$.groups.length()").value(1)).andExpect(jsonPath("$.groups[0].storeCount").value(3))
            .andExpect(jsonPath("$.groups[0].offers.length()").value(3)).andExpect(jsonPath("$.offers.length()").value(3))
            .andExpect(jsonPath("$.groups[0].fromPrice").value(1090000));
        http.perform(get("/api/catalog").param("grouped","true").param("size","1").param("page","1"))
            .andExpect(jsonPath("$.groups[0].offers.length()").value(1)).andExpect(jsonPath("$.offers[0].mount").value("Nikon Z"));
        http.perform(get("/api/catalog").param("grouped","true").param("retailer","a"))
            .andExpect(jsonPath("$.totalOffers").value(1)).andExpect(jsonPath("$.groups[0].storeCount").value(1));
        http.perform(get("/api/catalog").param("grouped","true").param("maxPrice","12000"))
            .andExpect(jsonPath("$.totalOffers").value(1)).andExpect(jsonPath("$.offers[0].retailer_id").value("c"));
    }
    @Test void groupedPriceDoesNotUseSoldOutLowPriceOrHighestOfferForDescendingSort() throws Exception {
        importer.ingest("group-prices",List.of(row("a","one","SEL50F18F","Sony E",1000000,now),
            row("b","two","SEL50F18F","Sony E",9000000,now),row("c","three","OTHER","Sony E",2000000,now),
            row("d","four","SEL50F18F","Sony E",500000,now)));
        db.update("UPDATE offer SET availability='OUT_OF_STOCK' WHERE retailer_id='d'");
        http.perform(get("/api/catalog").param("grouped","true").param("includeSoldOut","true"))
            .andExpect(jsonPath("$.groups[0].fromPrice").value(1000000)).andExpect(jsonPath("$.groups[0].storeCount").value(3))
            .andExpect(jsonPath("$.groups[0].inStockStoreCount").value(2));
        http.perform(get("/api/catalog").param("grouped","true").param("sort","price-desc"))
            .andExpect(jsonPath("$.groups[0].fromPrice").value(2000000));
        http.perform(get("/api/catalog").param("grouped","true").param("inStockOnly","true").param("includeSoldOut","true"))
            .andExpect(jsonPath("$.totalOffers").value(3));
    }

}
