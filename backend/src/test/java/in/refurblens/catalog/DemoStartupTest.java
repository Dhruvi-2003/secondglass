package in.refurblens.catalog;
import static org.assertj.core.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
@SpringBootTest(properties={"app.demo=true","spring.datasource.url=jdbc:h2:mem:demo;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"})
class DemoStartupTest {
    @Autowired DemoData demo;
    @Autowired JdbcTemplate db;
    @Test void sampleCatalogueStartsCompletelyAndRestartPreservesTimestamps() {
        assertThat(db.queryForObject("SELECT count(*) FROM offer",Integer.class)).isEqualTo(10);
        assertThat(db.queryForObject("SELECT count(*) FROM observation",Integer.class)).isEqualTo(13);
        assertThat(db.queryForObject("SELECT count(*) FROM rejected_observation",Integer.class)).isZero();
        var times=db.queryForList("SELECT observed_at FROM offer ORDER BY id");
        demo.run(new DefaultApplicationArguments(new String[0]));
        assertThat(db.queryForList("SELECT observed_at FROM offer ORDER BY id")).isEqualTo(times);
        assertThat(db.queryForObject("SELECT count(*) FROM observation",Integer.class)).isEqualTo(13);
    }
}
