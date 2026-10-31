package in.refurblens.catalog;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(properties={"app.demo=false","app.live-data=","spring.datasource.url=jdbc:h2:mem:live-tests;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"})
class LiveCatalogueTest {
 @Autowired ObjectMapper json;
 @Autowired ImportService importer;
 @Autowired JdbcTemplate db;
 @Autowired TransactionTemplate tx;
 @Autowired SellerPolicy policy;
 @TempDir Path dir;
 @BeforeEach void clear() { for(String table:List.of("observation","rejected_observation","import_batch","offer","configuration","retailer")) db.update("DELETE FROM "+table); }
 SourceObservation row(String seller,String key,long price) {
  return new SourceObservation(seller,"Test source",key,"Sony","FE 50mm F1.8","SEL50F18F","Sony E","FULL_FRAME",50,50,"1.8",true,false,"New","Public product snapshot; terms unconfirmed.","UNKNOWN","UNKNOWN","UNKNOWN",null,null,null,null,price,null,"UNKNOWN","https://"+Map.of("pooja","poojaelectronics.in","rk","www.rkdeals.co.in","amazon","www.amazon.in").get(seller)+"/lens",Instant.parse("2026-10-30T10:00:00Z"),false,"NEW");
 }
 void write(Path path,String source,List<SourceObservation> rows) throws Exception {
  json.writeValue(path.toFile(),new LiveCatalogue.Snapshot("2026-10-31T10:00:00Z",List.of(Map.of("id",source,"name","Test source","offers",rows.size(),"status","OK")),rows));
 }
 @Test void replayPreservesTimestampsAndNewType() throws Exception {
  Path path=dir.resolve("live.json");write(path,"pooja",List.of(row("pooja","one",1900000)));
  var loader=new LiveCatalogue(json,importer,db,tx,policy,path.toString(),false);loader.reload();loader.reload();
  assertThat(db.queryForObject("SELECT count(*) FROM observation obs JOIN offer o ON o.id=obs.offer_id WHERE retailer_id='pooja'",Integer.class)).isEqualTo(1);
  assertThat(db.queryForObject("SELECT listing_type FROM offer WHERE retailer_id='pooja'",String.class)).isEqualTo("NEW");
 }
 @Test void failedSnapshotRollsBackValidSiblingsAndKeepsPreviousOffers() throws Exception {
  Path path=dir.resolve("live.json");write(path,"rk",List.of(row("rk","original",1900000)));
  var loader=new LiveCatalogue(json,importer,db,tx,policy,path.toString(),false);loader.reload();
  write(path,"rk",List.of(row("rk","valid",1200000),row("rk","bad",0)));
  assertThatThrownBy(loader::reload).isInstanceOf(IllegalArgumentException.class);
  assertThat(db.queryForObject("SELECT count(*) FROM offer WHERE retailer_id='rk'",Integer.class)).isEqualTo(1);
  assertThat(db.queryForObject("SELECT active FROM offer WHERE retailer_id='rk'",Boolean.class)).isTrue();
 }
 @Test void disappearingOfferRetainsHistoryButLeavesSearch() throws Exception {
  Path path=dir.resolve("live.json");write(path,"amazon",List.of(row("amazon","one",1900000)));
  var loader=new LiveCatalogue(json,importer,db,tx,policy,path.toString(),false);loader.reload();
  write(path,"amazon",List.of());loader.reload();
  assertThat(db.queryForObject("SELECT active FROM offer WHERE retailer_id='amazon'",Boolean.class)).isFalse();
  assertThat(db.queryForObject("SELECT count(*) FROM observation obs JOIN offer o ON o.id=obs.offer_id WHERE retailer_id='amazon'",Integer.class)).isEqualTo(1);
 }
 @Test void removedRetailerLeavesSearchButKeepsHistory() throws Exception {
  importer.ingest("legacy-source",List.of(row("pooja","legacy",1900000)));
  db.update("INSERT INTO retailer(id,name) VALUES ('tapprs','Tapprs')");
  db.update("UPDATE offer SET retailer_id='tapprs' WHERE external_key='legacy'");
  Path path=dir.resolve("live.json");write(path,"pooja",List.of());
  new LiveCatalogue(json,importer,db,tx,policy,path.toString(),false).reload();
  assertThat(db.queryForObject("SELECT active FROM offer WHERE retailer_id='tapprs'",Boolean.class)).isFalse();
  assertThat(db.queryForObject("SELECT count(*) FROM observation obs JOIN offer o ON o.id=obs.offer_id WHERE retailer_id='tapprs'",Integer.class)).isEqualTo(1);
 }

}
