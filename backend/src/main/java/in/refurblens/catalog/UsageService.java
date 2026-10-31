package in.refurblens.catalog;

import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UsageService {
    private final JdbcTemplate db;
    private final Clock clock;
    public UsageService(JdbcTemplate db,Clock clock) { this.db=db; this.clock=clock; }
    public static final Set<String> EVENTS=Set.of("page_view","compare","detail","search_assist","feedback_helpful","feedback_missing_data","feedback_confusing");
    @Transactional
    public void count(String event) {
        if(event==null||!EVENTS.contains(event)) throw new IllegalArgumentException("Unsupported event.");
        db.queryForObject("SELECT id FROM ingest_lock WHERE id=1 FOR UPDATE",Integer.class);
        LocalDate day=LocalDate.now(clock);
        if(db.update("UPDATE usage_count SET total=total+1 WHERE event_day=? AND event_name=?",day,event)==0)
            db.update("INSERT INTO usage_count VALUES(?,?,1)",day,event);
        db.update("DELETE FROM usage_count WHERE event_day < ?",day.minusDays(90));
    }
    /** Reserve before an external call, including failed calls, to keep the configured daily cap conservative. */
    @Transactional
    public boolean reserveAi(int dailyLimit) {
        if(dailyLimit<=0) return false;
        db.queryForObject("SELECT id FROM ingest_lock WHERE id=1 FOR UPDATE",Integer.class);
        LocalDate day=LocalDate.now(clock);
        if(db.queryForObject("SELECT count(*) FROM ai_usage WHERE usage_day=?",Integer.class,day)==0) db.update("INSERT INTO ai_usage VALUES(?,0)",day);
        return db.update("UPDATE ai_usage SET attempts=attempts+1 WHERE usage_day=? AND attempts<?",day,dailyLimit)>0;
    }
}
