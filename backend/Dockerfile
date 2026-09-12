# ---- Build stage ----
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Copy wrapper + pom first so dependency resolution is cached as long
# as pom.xml doesn't change (faster rebuilds).
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
# Strip CRLF in case the repo was checked out on Windows without the
# .gitattributes rules applied (e.g. an older clone).
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw dependency:go-offline -B

COPY src ./src
RUN ./mvnw clean package -DskipTests -B

# ---- Runtime stage ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080
# Which Spring profile is active is controlled by the SPRING_PROFILES_ACTIVE
# env var set on the Render service, not hardcoded here.
ENTRYPOINT ["java", "-jar", "app.jar"]
