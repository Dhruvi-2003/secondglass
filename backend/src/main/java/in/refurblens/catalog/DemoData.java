package in.refurblens.catalog;

import java.time.*;
import java.util.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(name="app.demo",havingValue="true")
public class DemoData implements ApplicationRunner {
    private final ImportService importer;
    private final JdbcTemplate db;
    private final Clock clock;
    public DemoData(ImportService importer,JdbcTemplate db,Clock clock) { this.importer=importer; this.db=db; this.clock=clock; }
    private record Lens(String brand,String name,String code,String coverage,int min,int max,String aperture,Boolean stabilized) {}
    private static final Lens FE50=new Lens("Sony","FE 50mm F1.8","SEL50F18F","FULL_FRAME",50,50,"1.8",false);
    private static final Lens E50=new Lens("Sony","E 50mm F1.8 OSS","SEL50F18","APS_C",50,50,"1.8",true);
    private static final Lens SIGMA=new Lens("Sigma","18–50mm F2.8 DC DN Contemporary","C021-18-50-2.8","APS_C",18,50,"2.8",false);
    private static final Lens TAMRON=new Lens("Tamron","28–75mm F2.8 Di III VXD G2","A063","FULL_FRAME",28,75,"2.8",false);
    private static final Lens UNKNOWN=new Lens("Sony","50mm F1.8 · variant unspecified",null,null,50,50,"1.8",null);

    @Override @Transactional public void run(ApplicationArguments args) {
        if(db.queryForObject("SELECT count(*) FROM import_batch WHERE id='demo-v1-current'",Integer.class)>0) return;
        Instant now=clock.instant().minusSeconds(3600);
        for(int days:List.of(14,7,3)) if(db.queryForObject("SELECT count(*) FROM import_batch WHERE id=?",Integer.class,"demo-v1-history-"+days)==0)
            importer.ingest("demo-v1-history-"+days,List.of(row("a","fe50-a",FE50,12900+days*100,now.minus(Duration.ofDays(days)),"clean","IN_STOCK")));
        var rows=List.of(
            row("a","fe50-a",FE50,12900,now,"clean","IN_STOCK"),
            row("b","fe50-b",FE50,10900,now.minusSeconds(3600),"fungus","IN_STOCK"),
            row("c","fe50-c",FE50,13900,now.minusSeconds(7200),"unknown","IN_STOCK"),
            row("a","e50-a",E50,14900,now,"clean","IN_STOCK"),
            row("b","sigma-b",SIGMA,35900,now.minusSeconds(10800),"clean","IN_STOCK"),
            row("a","sigma-a",SIGMA,32900,now.minusSeconds(3600),"scratch","IN_STOCK"),
            row("c","tamron-c",TAMRON,52900,now.minus(Duration.ofHours(58)),"clean","IN_STOCK"),
            row("b","tamron-b",TAMRON,49900,now,"clean","OUT_OF_STOCK"),
            row("c","unknown-c",UNKNOWN,9900,now.minusSeconds(14400),"unknown","IN_STOCK"),
            row("c","e50-c",E50,13900,now.minusSeconds(7200),"haze","UNKNOWN")
        );
        importer.ingest("demo-v1-current",rows);
    }
    private SourceObservation row(String seller,String key,Lens lens,int rupees,Instant at,String condition,String stock) {
        String name=switch(seller) {case "a"->"Demo · Aperture House";case "b"->"Demo · Frame Exchange";default->"Demo · Focus Room";};
        String notes=switch(condition) {
            case "clean"->"Seller reports no fungus, haze or optical scratches. Light wear on the barrel. Focus operation checked by seller.";
            case "fungus"->"Small fungus patch on an internal element. Cleaning recommended. Seller reports no haze or optical scratches.";
            case "scratch"->"Fine scratch on the front element. Seller reports no fungus or haze. Barrel shows handling marks.";
            case "haze"->"Light internal haze disclosed. Fungus and scratch condition not specified. Inspection recommended.";
            default->"Cosmetic condition described as good. Seller has not disclosed fungus, haze or optical scratch status.";
        };
        boolean unknown=condition.equals("unknown")||condition.equals("haze");
        Integer warranty=null,returns=null;
        Long shipping=null;
        if(seller.equals("a")) { warranty=3; returns=7; shipping=0L; }
        if(seller.equals("b")) { warranty=1; returns=3; shipping=25000L; }
        return new SourceObservation("demo-"+seller,name,key,lens.brand(),lens.name(),lens.code(),"Sony E",lens.coverage(),lens.min(),lens.max(),lens.aperture(),true,lens.stabilized(),
            condition.equals("clean")?"Excellent":condition.equals("unknown")?"Good":"Well used",notes,
            condition.equals("fungus")?"PRESENT":unknown?"UNKNOWN":"ABSENT",
            condition.equals("scratch")?"PRESENT":unknown?"UNKNOWN":"ABSENT",
            condition.equals("haze")?"PRESENT":condition.equals("unknown")?"UNKNOWN":"ABSENT",
            seller.equals("a")?"Front and rear caps; hood":seller.equals("b")?"Front and rear caps; hood not included":null,
            warranty,seller.equals("c")?null:"Illustrative seller warranty on mechanical faults; disclosed optical defects excluded.",
            returns,rupees*100L,shipping,stock,null,at,true);
    }
}
