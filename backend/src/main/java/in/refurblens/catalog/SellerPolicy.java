package in.refurblens.catalog;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.util.*;
import org.springframework.stereotype.Component;

/** Retail destinations reviewed for this catalogue. Inclusion is not a safety or authorization badge. */
@Component
public class SellerPolicy {
    private final Map<String,Map<String,String>> retailers;
    public SellerPolicy(ObjectMapper json) throws IOException {
        try(var stream=SellerPolicy.class.getResourceAsStream("/retailers.json")) {
            if(stream==null) throw new IOException("Retailer registry missing");
            retailers=json.readValue(stream,new TypeReference<>() {});
        }
    }
    public Set<String> sourceIds() { return Set.copyOf(retailers.keySet()); }
    public void validate(String retailerId,String url) {
        var retailer=retailers.get(retailerId);
        if(retailer==null) throw new IllegalArgumentException("Real offers require a reviewed retail source; person-to-person listings are not supported.");
        URI uri=URI.create(url);
        if(!"https".equals(uri.getScheme()) || !retailer.get("host").equalsIgnoreCase(uri.getHost()) || uri.getUserInfo()!=null || uri.getPort()!=-1 && uri.getPort()!=443)
            throw new IllegalArgumentException("Purchase link does not match the reviewed retailer.");
    }
}
