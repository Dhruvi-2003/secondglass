package in.refurblens.catalog;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Local-pilot protections; the deployment edge must enforce shared limits across replicas. */
@Component
public class WebBoundary extends OncePerRequestFilter {
    private final Map<String,Window> clients=new HashMap<>();
    private record Window(long minute,int requests) {}
    private synchronized boolean allowed(String address) {
        long minute=System.currentTimeMillis()/60000;
        clients.entrySet().removeIf(e->e.getValue().minute()!=minute);
        if(!clients.containsKey(address)&&clients.size()>=10000) return false;
        var old=clients.getOrDefault(address,new Window(minute,0));
        clients.put(address,new Window(minute,old.requests()+1));
        return old.requests()<60;
    }
    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
        res.setHeader("X-Content-Type-Options","nosniff");
        res.setHeader("Referrer-Policy","no-referrer");
        res.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
        if(req.getRequestURI().startsWith("/api/")) res.setHeader("Cache-Control","no-store");
        if(req.getMethod().equals("POST")) {
            if("cross-site".equals(req.getHeader("Sec-Fetch-Site"))) { res.sendError(403); return; }
            if(req.getContentLengthLong()>512_000) { res.sendError(413); return; }
            if(!allowed(req.getRemoteAddr())) { res.setHeader("Retry-After","60"); res.sendError(429); return; }
        }
        chain.doFilter(req,res);
    }
}
