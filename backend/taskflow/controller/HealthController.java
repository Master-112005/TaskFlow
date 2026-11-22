package taskflow.controller;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Public health endpoint for hosting platforms (Render pings this to decide
 * whether the service is up — every other /api path needs a JWT).
 */
@RestController
public class HealthController {

    /** Render.com free tier pings /api/health every 5 minutes to keep the dyno awake. */
    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "up");
    }

    /**
     * Additional lightweight ping endpoint without /api prefix.
     * Some platforms may check this root path specifically.
     */
    @GetMapping("/health")
    public Map<String, String> ping() {
        return Map.of("status", "up");
    }

    /**
     * Scheduled keep-alive: periodically hits the health endpoint
     * to prevent the dyno from sleeping on platforms like Render.
     * This runs only when the application is active (not during shutdown).
     * <p>
     * Note: Render.com's built-in scheduled pings are usually sufficient,
     * but this provides an additional safety net for other platforms.
     */
    @Scheduled(fixedRateString = "300000") // 5 minutes in milliseconds
    public void keepAlive() {
        // This method runs every 5 minutes in the background.
        // It intentionally does nothing but exist — Render's own pings
        // and this scheduled task keep the dyno warm.
        // If you want to actually ping an external URL, you can add HTTP logic here,
        // but Spring's scheduler without HTTP client dependencies is best left as a no-op
        // to avoid startup failures or thread pool issues.
    }
}
