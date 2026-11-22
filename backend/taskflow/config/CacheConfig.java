package taskflow.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {

    /** Caffeine cache with 10-minute maximum TTL and 1000-entry limit. */
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager("users");
        cacheManager.getCaffeine().maximumSize(1000);
        cacheManager.getCaffeine().expireAfterWrite(10, TimeUnit.MINUTES);
        return cacheManager;
    }
}