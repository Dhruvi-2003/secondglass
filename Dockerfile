FROM node:22-alpine AS frontend
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM maven:3.9-eclipse-temurin-17 AS backend
WORKDIR /workspace/backend
COPY backend/pom.xml ./
COPY backend/src ./src
COPY --from=frontend /workspace/backend/src/main/resources/static ./src/main/resources/static
RUN mvn -B package

FROM eclipse-temurin:17-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=backend --chown=app:app /workspace/backend/target/catalog-0.1.0.jar /app/app.jar
COPY --chown=app:app catalogue /app/catalogue
RUN mkdir /app/data && chown app:app /app/data
USER app
ENV PORT=8086 BIND_ADDRESS=0.0.0.0 LIVE_DATA_PATH=/app/catalogue/live.json
EXPOSE 8086
ENTRYPOINT ["java","-jar","/app/app.jar"]
