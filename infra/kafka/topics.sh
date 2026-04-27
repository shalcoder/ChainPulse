#!/bin/bash
# Kafka topic creation script
# Run once after Kafka is healthy
# Each topic is created with explicit partition count and replication factor

KAFKA_BROKER="kafka:29092"

echo "Waiting for Kafka to be ready..."
sleep 5

echo "Creating Kafka topics..."

# GPS updates — 3 partitions because this is the highest-volume topic
# 20 vehicles each sending updates every 2 seconds
kafka-topics --create \
  --if-not-exists \
  --bootstrap-server $KAFKA_BROKER \
  --topic gps-updates \
  --partitions 3 \
  --replication-factor 1

# Weather alerts — 1 partition, low volume, order matters
kafka-topics --create \
  --if-not-exists \
  --bootstrap-server $KAFKA_BROKER \
  --topic weather-alerts \
  --partitions 1 \
  --replication-factor 1

# Order events — 1 partition, medium volume
kafka-topics --create \
  --if-not-exists \
  --bootstrap-server $KAFKA_BROKER \
  --topic order-events \
  --partitions 1 \
  --replication-factor 1

# Warehouse events — 1 partition, low volume
kafka-topics --create \
  --if-not-exists \
  --bootstrap-server $KAFKA_BROKER \
  --topic warehouse-events \
  --partitions 1 \
  --replication-factor 1

# Route decisions — output topic for frontend WebSocket fallback
kafka-topics --create \
  --if-not-exists \
  --bootstrap-server $KAFKA_BROKER \
  --topic route-decisions \
  --partitions 1 \
  --replication-factor 1

echo "All topics created successfully."
kafka-topics --list --bootstrap-server $KAFKA_BROKER