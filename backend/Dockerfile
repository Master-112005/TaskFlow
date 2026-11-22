# ---------- build ----------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# This repo uses a non-standard Maven layout:
#   pom.xml at backend/
#   sources in backend/taskflow/
#   config in backend/resources/
COPY pom.xml .
COPY taskflow ./taskflow
COPY resources ./resources

RUN mvn -B -DskipTests package

# ---------- run ----------
FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=build /app/target/taskflow-backend-0.0.1-SNAPSHOT.jar app.jar

# Render injects PORT (usually 10000). Spring Boot must listen on it.
CMD ["sh", "-c", "java -jar app.jar --server.port=${PORT:-8080}"]
