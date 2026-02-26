---
layout: post
title: -how-facebook-youtube-handle-billions-of-likes-views (DESIGN)
author: jane
date: 2026-02-26 09:00:00
categories: [ -how-facebook-youtube-handle-billions-of-likes-views, DESIGN, system-design ]
image: assets/images/4.jpg
---

Interviewer: Let's design a system to handle billions of likes and views for a social media platform similar to Facebook or YouTube. We need to store and serve this data at massive scale. What are your initial thoughts on the requirements?

Candidate: Okay, let's break this down. To design a system capable of handling billions of likes and views, we first need a clear understanding of the scale and operational characteristics.

**Clarify:**

*   **DAU/MAU:** For a platform like Facebook or YouTube, we're looking at billions of Monthly Active Users (MAU) and hundreds of millions to over a billion Daily Active Users (DAU). Let's assume for this design, we target **1 billion DAU** and **3 billion MAU**.
*   **Peak Concurrent Users:** During peak hours, a significant portion of DAU will be active simultaneously. Let's estimate **500 million concurrent users** actively interacting with the platform.
*   **Read/Write Ratio:** Likes and views are primarily read operations. A typical ratio might be **1000 reads for every 1 write**. For likes, a user can view many posts without liking, but liking is a distinct action. Views are even more frequent.
*   **Payload Size:**
    *   A "like" event is very small: user ID, post ID, timestamp. Let's say **~50 bytes**.
    *   A "view" event can be larger, especially if it includes watch progress, device info, etc. For simplicity, let's estimate **~200 bytes** for a view event.
*   **Geo Distribution:** Global user base. Traffic will be distributed across major continents (North America, Europe, Asia, South America, Africa, Oceania). Low latency is critical for user experience.
*   **SLA/SLO Targets:**
    *   **Availability:** For core functionalities like liking and viewing, we aim for **99.99% availability**.
    *   **Latency:**
        *   Likes (write): P95 < 100ms, P99 < 200ms.
        *   Views (write): P95 < 150ms, P99 < 300ms.
        *   Read (get likes/views for a post): P95 < 50ms, P99 < 100ms.
    *   **Throughput:** Needs to handle peak write and read loads.
    *   **Durability:** No loss of likes or views is acceptable.
*   **Consistency Model Expectations:**
    *   **Writes (Likes/Views):** Eventual consistency is acceptable. Users might not see their like immediately reflected across all global views, but it should appear within seconds.
    *   **Reads (Counts):** For display counts on posts, eventual consistency is fine. Showing a count that is a few seconds stale is acceptable. Stronger consistency might be needed for certain internal analytics or moderation tasks, but not for the primary user-facing display.
*   **Multi-Region Requirement:** Absolutely essential given the global user base and availability targets.
*   **Data Retention Policy:** Likes might be retained indefinitely for user history and analytics. Views might have a shorter retention, e.g., 1-2 years, depending on analytics needs and storage costs. Let's assume **indefinite for likes, 2 years for views**.
*   **Abuse and Adversarial Scenarios:**
    *   Bots generating fake likes/views.
    *   DDoS attacks on write or read endpoints.
    *   Malicious traffic spikes.
    *   Attempting to manipulate counts.
*   **Regulatory Constraints:** GDPR, CCPA, etc., regarding user data privacy and retention. Likes are tied to user profiles.
*   **Cost Sensitivity:** While scale is paramount, cost efficiency is always a consideration. We need to balance performance with operational costs.

**Requirements:**

**Functional Requirements:**

1.  **Record a Like:** A user can like a specific content item (post, video, etc.).
2.  **Record a View:** A user can trigger a view event for a content item. This might include progress updates for videos.
3.  **Get Like Count:** Retrieve the total number of likes for a given content item.
4.  **Get View Count:** Retrieve the total number of views for a given content item.
5.  **Get User's Liked Content (Optional but good to consider):** Retrieve a list of content items a user has liked.
6.  **Get User's Viewed Content (Optional but good to consider):** Retrieve a history of content items a user has viewed.

**Non-Functional Requirements:**

*   **Availability:** 99.99% for all read and write operations.
*   **Latency:**
    *   Writes (Likes): P95 < 100ms, P99 < 200ms.
    *   Writes (Views): P95 < 150ms, P99 < 300ms.
    *   Reads (Counts): P95 < 50ms, P99 < 100ms.
*   **Throughput:**
    *   Writes: Capable of handling peak loads from 1 billion DAU.
    *   Reads: Capable of handling peak loads from 1 billion DAU.
*   **Durability:** No data loss for likes and views.
*   **Consistency:**
    *   Writes: Eventual consistency.
    *   Reads (Counts): Eventual consistency (counts can be slightly stale).
*   **Scalability:** System must scale horizontally to handle 10x future growth.
*   **Security:** Protect against common web vulnerabilities, ensure data privacy.
*   **Cost Ceiling:** Maintain cost-effectiveness through efficient resource utilization.

**Back-of-the-Envelope Calculations:**

Let's make some assumptions:
*   DAU: 1 billion
*   MAU: 3 billion
*   Concurrent Users (peak): 500 million
*   Read/Write Ratio: 1000:1 (for counts)
*   Like Event Size: 50 bytes
*   View Event Size: 200 bytes
*   Average Likes per DAU per day: Assume 10 likes/DAU/day.
*   Average Views per DAU per day: Assume 50 views/DAU/day.

**Compute:**

*   **Daily Likes:**
    $$ 1 \text{ billion DAU} \times 10 \text{ likes/DAU} = 10 \text{ billion likes/day} $$
*   **Daily Views:**
    $$ 1 \text{ billion DAU} \times 50 \text{ views/DAU} = 50 \text{ billion views/day} $$

*   **Write QPS (Peak):**
    *   Likes: A significant portion of DAU will interact during peak hours. Assume peak activity is 5x average daily rate.
        $$ \text{Peak Likes QPS} = \frac{10 \text{ billion likes/day} \times 5}{24 \text{ hours/day} \times 3600 \text{ seconds/hour}} \approx \frac{50 \text{ billion}}{86400} \approx 578,704 \text{ QPS} $$
    *   Views: Similar peak activity.
        $$ \text{Peak Views QPS} = \frac{50 \text{ billion views/day} \times 5}{24 \text{ hours/day} \times 3600 \text{ seconds/hour}} \approx \frac{250 \text{ billion}}{86400} \approx 2,893,519 \text{ QPS} $$
    *   **Total Peak Write QPS:**
        $$ 578,704 + 2,893,519 \approx 3.5 \text{ million QPS} $$

*   **Read QPS (Peak Counts):**
    *   Assume 1000 reads for every 1 write (for counts). This is a simplification; actual read patterns for counts are complex and depend on content popularity. Let's assume a higher read factor for counts due to users refreshing feeds, viewing popular posts. Let's assume 10,000 reads for every 1 write for counts.
    *   Total writes/day = 10B (likes) + 50B (views) = 60B.
    *   Total reads/day = 60B * 10,000 = 600 Trillion. This is too high.
    *   Let's re-evaluate: A user might see a post with its like count multiple times. A more realistic approach is to consider concurrent users and typical interaction rates.
    *   If 500M users are active, and each checks 10 posts per minute (a rough guess), that's 5 billion post views per minute. If each post view involves fetching its like/view count, this is very high.
    *   Let's assume a more conservative peak read QPS for counts. If each of the 500M concurrent users requests counts for, say, 5 posts per minute on average:
        $$ \text{Peak Read QPS} = 500 \text{ million users} \times 5 \text{ posts/min/user} \times \frac{1 \text{ min}}{60 \text{ sec}} \approx 41.7 \text{ million QPS} $$
    *   This is for *counts only*. Individual likes/views are not read directly in this model, only aggregated.

*   **Storage:**
    *   **Likes:**
        *   Daily storage: $$ 10 \text{ billion likes} \times 50 \text{ bytes/like} = 500 \text{ GB/day} $$
        *   Annual storage: $$ 500 \text{ GB/day} \times 365 \text{ days/year} \approx 182.5 \text{ TB/year} $$
        *   With indefinite retention, this grows linearly. Let's consider 5 years of data: $$ 182.5 \text{ TB/year} \times 5 \text{ years} \approx 912.5 \text{ TB} $$
    *   **Views:**
        *   Daily storage: $$ 50 \text{ billion views} \times 200 \text{ bytes/view} = 10 \text{ TB/day} $$
        *   Annual storage: $$ 10 \text{ TB/day} \times 365 \text{ days/year} \approx 3.65 \text{ PB/year} $$
        *   With 2-year retention: $$ 3.65 \text{ PB/year} \times 2 \text{ years} \approx 7.3 \text{ PB} $$
    *   **Total Storage (approx. 5 years):** ~7.3 PB (views) + ~1 PB (likes) = **~8.3 PB**. This is a massive amount of data.
    *   **Aggregated Counts Storage:** This would be much smaller. If we store counts per content item, and assume millions of active content items, each storing a few counters (likes, views, etc.), this would be in the TB range, negligible compared to raw event data.

*   **Bandwidth:**
    *   **Write Bandwidth (Peak):**
        *   Likes: $$ 578,704 \text{ QPS} \times 50 \text{ bytes/like} \approx 28.9 \text{ MB/s} $$
        *   Views: $$ 2,893,519 \text{ QPS} \times 200 \text{ bytes/view} \approx 578.7 \text{ MB/s} $$
        *   **Total Peak Write Bandwidth:** $$ \approx 607.6 \text{ MB/s} $$
    *   **Read Bandwidth (Peak Counts):**
        *   $$ 41.7 \text{ million QPS} \times (\text{small payload for counts, e.g., 32 bytes}) \approx 1.3 \text{ GB/s} $$
    *   **Cross-Region Replication Bandwidth:**
        *   This is a significant cost. If we replicate all writes to N regions, the bandwidth is N times the single-region write bandwidth. Assuming 3 major regions (e.g., US, EU, Asia), and replicating all writes:
        *   $$ \text{Replication Bandwidth} \approx (\text{Total Write QPS}) \times (\text{Average Event Size}) \times (\text{# of regions to replicate to}) $$
        *   Let's assume we replicate all writes to 2 other regions for active-active setup.
        *   Total write QPS = 3.5M. Average event size = (10B * 50B + 50B * 200B) / 60B = (500GB + 10TB) / 60B ≈ 176 bytes.
        *   $$ \text{Replication Bandwidth} \approx 3.5 \text{ million QPS} \times 176 \text{ bytes/event} \times 2 \text{ regions} \approx 1.2 \text{ GB/s} $$
        *   This is a baseline. If we do stronger consistency or real-time analytics, this could be higher.

*   **Estimated Infra Cost Order of Magnitude:**
    *   Storage: Petabytes of data require significant storage infrastructure. Assuming $0.02/GB/month for hot/warm storage, 8.3 PB would cost: $$ 8.3 \times 10^6 \text{ GB} \times \$0.02/\text{GB/month} \times 12 \text{ months/year} \approx \$2 \text{ million/year} $$
    *   Compute: Millions of QPS for writes and reads require a large fleet of compute instances. This is hard to estimate precisely without knowing instance types, but likely in the tens of millions of dollars annually for compute and networking.
    *   Networking: High bandwidth requirements, especially cross-region, add significant costs. Likely millions of dollars annually.
    *   **Total Order of Magnitude:** This system would likely cost **tens to hundreds of millions of dollars annually** to operate.

---

## Step 2 — High-Level Architecture

**API Design**

We'll design a simple, efficient API for recording events and retrieving counts.

**Core REST Endpoints:**

1.  **Record Like:**
    *   `POST /v1/likes`
    *   **Request:**
        ```json
        {
          "user_id": "user123",
          "content_id": "post456",
          "timestamp": "2023-10-27T10:00:00Z",
          "idempotency_key": "unique_like_event_id_abc" // Optional, for at-least-once/exactly-once
        }
        ```
    *   **Response:**
        ```json
        {
          "status": "accepted", // or "acknowledged"
          "message": "Like recorded successfully."
        }
        ```

2.  **Record View:**
    *   `POST /v1/views`
    *   **Request:**
        ```json
        {
          "user_id": "user123",
          "content_id": "video789",
          "timestamp": "2023-10-27T10:01:00Z",
          "progress_ms": 15000, // Optional: progress in milliseconds for video
          "device_info": { ... }, // Optional
          "idempotency_key": "unique_view_event_id_xyz" // Optional
        }
        ```
    *   **Response:**
        ```json
        {
          "status": "accepted",
          "message": "View recorded successfully."
        }
        ```

3.  **Get Like Count:**
    *   `GET /v1/content/{content_id}/likes/count`
    *   **Response:**
        ```json
        {
          "content_id": "post456",
          "like_count": 15789,
          "last_updated_timestamp": "2023-10-27T10:00:05Z" // Indicative of staleness
        }
        ```

4.  **Get View Count:**
    *   `GET /v1/content/{content_id}/views/count`
    *   **Response:**
        ```json
        {
          "content_id": "video789",
          "view_count": 123456,
          "last_updated_timestamp": "2023-10-27T10:01:05Z"
        }
        ```

**Architecture Diagram**

```mermaid
graph LR
    Client[Client App] --> Edge[Edge CDN/PoP]
    Edge --> WAF[WAF]
    WAF --> LB_API[API LB]

    LB_API --> Service_Like[Like Service]
    LB_API --> Service_View[View Service]
    LB_API --> Service_Count[Count Service]

    Service_Like --> Cache_Write[Write Cache]
    Service_View --> Cache_Write
    Service_Count --> Cache_Read[Read Cache]

    Cache_Write --> Queue[Message Queue<br>(Kafka/Pulsar)]

    Queue --> Worker_Like[Like Worker]
    Queue --> Worker_View[View Worker]

    Worker_Like --> DB_Like[Likes DB<br>(Cassandra/ScyllaDB)]
    Worker_View --> DB_View[Views DB<br>(Cassandra/ScyllaDB)]

    Service_Count --> DB_Count[Counts DB<br>(Redis/Aerospike)]

    DB_Like --> Aggregator[Aggregation Service]
    DB_View --> Aggregator

    Aggregator --> Queue_Agg[Aggregation Queue]
    Queue_Agg --> Worker_Agg[Aggregation Worker]
    Worker_Agg --> DB_Count

    %% Multi-Region Replication
    subgraph Multi-Region Replication
        Queue -- Replicate --> Queue_Region2[Message Queue<br>Region 2]
        Queue -- Replicate --> Queue_Region3[Message Queue<br>Region 3]
        DB_Like -- Replicate --> DB_Like_R2[Likes DB<br>Region 2]
        DB_Like -- Replicate --> DB_Like_R3[Likes DB<br>Region 3]
        DB_View -- Replicate --> DB_View_R2[Views DB<br>Region 2]
        DB_View -- Replicate --> DB_View_R3[Views DB<br>Region 3]
        DB_Count -- Replicate --> DB_Count_R2[Counts DB<br>Region 2]
        DB_Count -- Replicate --> DB_Count_R3[Counts DB<br>Region 3]
    end

    %% Observability
    subgraph Observability
        Service_Like --> Metrics[Metrics Collector]
        Service_View --> Metrics
        Service_Count --> Metrics
        Worker_Like --> Metrics
        Worker_View --> Metrics
        Worker_Agg --> Metrics
        DB_Like --> Metrics
        DB_View --> Metrics
        DB_Count --> Metrics
        Queue --> Metrics

        Service_Like --> Tracing[Distributed Tracing]
        Service_View --> Tracing
        Service_Count --> Tracing
        Worker_Like --> Tracing
        Worker_View --> Tracing
        Worker_Agg --> Tracing

        Service_Like --> Logging[Structured Logging]
        Service_View --> Logging
        Service_Count --> Logging
        Worker_Like --> Logging
        Worker_View --> Logging
        Worker_Agg --> Logging
    end
```

**Primary Flow:**

**1. Write Path (Likes/Views):**

1.  **Client App:** Initiates a like or view action.
2.  **Edge CDN/PoP:** Caches static assets and may perform initial request filtering.
3.  **WAF (Web Application Firewall):** Protects against common web exploits and DDoS attacks.
4.  **API Load Balancer (LB_API):** Distributes incoming write requests across available stateless service instances.
5.  **Stateless Service (Service_Like / Service_View):**
    *   Validates the request (user, content ID, timestamp).
    *   Generates an idempotency key if applicable.
    *   Writes the event data (user ID, content ID, timestamp, etc.) to a **Write Cache (Cache_Write)** for immediate acknowledgment and potential de-duplication.
    *   Publishes the event to a **Message Queue (Queue)** for asynchronous processing.
    *   Returns an "accepted" response to the client.
6.  **Message Queue (Queue):** Durably stores incoming events. This decouples the write service from downstream processing. The queue is configured for multi-region replication.
7.  **Worker Services (Worker_Like / Worker_View):**
    *   Consume events from the Message Queue.
    *   Perform de-duplication using idempotency keys.
    *   Write the raw event data to the respective **Primary Database (DB_Like / DB_View)**. This database is designed for high write throughput and durability (e.g., Cassandra, ScyllaDB).
    *   These databases are sharded and replicated across multiple regions.

**2. Read Path (Counts):**

1.  **Client App:** Requests the like/view count for a specific content item.
2.  **Edge CDN/PoP:** May cache popular content counts.
3.  **WAF:** Filters requests.
4.  **API Load Balancer (LB_API):** Distributes read requests.
5.  **Stateless Service (Service_Count):**
    *   Receives the `content_id`.
    *   Queries the **Read Cache (Cache_Read)** for the count. The cache is populated by the Aggregation Service.
    *   If the count is not in the cache or is stale (based on a TTL), the service queries the **Counts DB (DB_Count)**.
    *   Returns the count to the client.

**3. Async Path (Aggregations):**

1.  **Worker Services (Worker_Like / Worker_View):** After writing raw events to `DB_Like` and `DB_View`, they may publish a message to an **Aggregation Queue (Queue_Agg)** indicating that new data is available for aggregation.
2.  **Aggregation Service (Aggregator):** This service is responsible for periodically reading raw events from `DB_Like` and `DB_View` and computing aggregated counts. It might operate in batches or use a stream processing approach.
3.  **Aggregation Worker (Worker_Agg):**
    *   Consumes events or triggers from `Queue_Agg`.
    *   Reads raw events from `DB_Like` and `DB_View` within a defined time window.
    *   Performs aggregations (e.g., summing up likes/views for a `content_id`).
    *   Updates the **Counts DB (DB_Count)** with the new aggregated counts. This DB is optimized for fast reads and writes of small aggregated values (e.g., Redis Cluster, Aerospike).
    *   The `DB_Count` is also replicated across regions.

**Multi-Region Replication:**

*   The **Message Queue** is configured for cross-region replication to ensure durability and availability.
*   **Databases (DB_Like, DB_View, DB_Count)** are geographically distributed and replicated. Writes are typically handled in the closest region and then replicated asynchronously or semi-synchronously to other regions. Read requests for counts can be served from the nearest regional cache or database.

**Observability:**

*   **Metrics Collector:** Gathers metrics (QPS, latency, error rates, resource utilization) from all services and databases.
*   **Distributed Tracing:** Tracks requests end-to-end across services to identify bottlenecks.
*   **Structured Logging:** Logs events and errors for debugging and auditing.

---

## Step 3 — Deep Dive (Distinguished Level)

The two hardest bottlenecks in this system are:

1.  **Write Path: Handling Billions of Events Per Day and Cross-Region Replication Consistency.**
2.  **Read Path: Serving Billions of Count Reads Per Day with Low Latency and High Availability Across Regions.**

---

### Bottleneck 1: Write Path - Handling Billions of Events Per Day and Cross-Region Replication Consistency

**1. Precise Failure Scenario:**

A global social media platform experiences a sudden, massive surge in traffic due to a viral event, amplified by bot activity. Simultaneously, a network partition occurs between two major regions (e.g., US-East and EU-West), disrupting cross-region replication for writes. The system must continue accepting writes from all regions without data loss or significant degradation, while also managing the eventual reconciliation of data between regions once the partition heals.

**2. Why Naive Solution Fails Mathematically:**

*   **Naive Approach:** A simple sharded database (like Cassandra) with asynchronous replication across regions.
*   **Failure Mode:**
    *   **Write Amplification & Hot Shards:** During a traffic surge, even if sharded, certain hot content IDs (e.g., a trending topic) could overwhelm specific shards. If these hot shards are in one region, replication lag to other regions can become extreme.
    *   **Network Partition:** Asynchronous replication means writes in Region A complete and acknowledge to the client *before* they are replicated to Region B. If Region B is unreachable, writes to Region A's shards will succeed, but Region B's corresponding shards will lag. When the partition heals, a massive backlog of writes needs to be applied. If there are conflicting writes (though unlikely for simple likes/views, it's a risk for more complex data), or if the downstream system cannot keep up, data loss or inconsistency can occur.
    *   **Write Latency SLA Violation:** During a surge and partition, write latency can increase significantly as queues fill up and network congestion worsens. P99 latency targets will be missed.
    *   **Data Loss:** While Cassandra itself is durable, if a region goes down *before* its writes are replicated to another durable region, and that region's data is lost (e.g., due to hardware failure and no recent backups), data could be lost. Our SLA requires zero data loss.

*   **Mathematical Failure:**
    Consider a single hot content ID `C`. Assume it receives `W` write operations per second.
    If a shard is responsible for `C` and can only process `w_shard` writes per second, and `W > w_shard`, then a backlog forms.
    $$ \text{Backlog size} = (W - w_{\text{shard}}) \times \Delta t $$
    If replication lag is `L` seconds, and a partition occurs, the backlog can grow significantly. If `W` is 10x the shard capacity, and replication lag is 60 seconds, the backlog can be `(10w - w) * 60 = 9w * 60` operations. If `w` is, say, 1000 QPS, that's 540,000 operations waiting. If the partition lasts for `T_partition` hours, the backlog can be enormous.
    $$ \text{Total backlogged writes} = (W - w_{\text{shard}}) \times T_{\text{partition}} \times 3600 $$

**3. Alternative Designs:**

*   **Design A: Multi-Master Writes with Conflict Resolution (e.g., CRDTs or Last-Write-Wins with Vector Clocks)**
    *   **Description:** Each region acts as a primary for its local writes. Writes are accepted locally with high availability. A conflict resolution strategy (like Last-Write-Wins with vector clocks, or Conflict-free Replicated Data Types (CRDTs)) is applied during replication. For likes/views, LWW based on timestamp is usually sufficient.
    *   **Pros:** High availability during partitions; low write latency as writes are acknowledged locally.
    *   **Cons:** Increased complexity in data modeling and replication logic. Requires careful handling of timestamps and potential clock skew. Can be challenging to implement for complex data types.
    *   **CAP Tradeoff:** Prioritizes Availability and Partition Tolerance (AP). Consistency is eventual.

*   **Design B: Geo-Partitioning with Regional Primary for Specific Data**
    *   **Description:** Partition content IDs such that specific ranges are primarily owned by a particular region. For example, content IDs starting with 'A'-'F' are primary in US-East, 'G'-'M' in EU-West, etc. Writes for primary content go to the primary region first, then replicate. Reads can be served locally.
    *   **Pros:** Simpler replication model. Reduces contention on cross-region writes for the same content ID.
    *   **Cons:** Can lead to "hot regions" if viral content is concentrated in one primary region. Requires careful data distribution and rebalancing strategies. Read latency might increase if users access content primarily owned by a remote region.
    *   **CAP Tradeoff:** Can lean towards Consistency and Partition Tolerance (CP) within a region, but globally is AP.

*   **Design C: Global Transaction Log with Replicated State Machines (e.g., Apache Kafka + State Stores)**
    *   **Description:** All writes (likes/views) are appended to a globally replicated, ordered log (like Kafka). Each region consumes from this log and updates its local state (e.g., a distributed database or a state store like RocksDB/ScyllaDB). This log provides a single source of truth.
    *   **Pros:** Strong ordering guarantees. Simplifies reconciliation during partitions. All regions eventually converge to the same state.
    *   **Cons:** Log replication itself can be a bottleneck. Latency for writes might increase if global ordering is strictly enforced. The log can become a single point of failure or bottleneck if not scaled properly.
    *   **CAP Tradeoff:** Prioritizes Partition Tolerance and Consistency (CP) for the log, making the state machines eventually consistent.

**4. CAP Tradeoff Analysis:**

*   **Design A (Multi-Master LWW):** Achieves AP. For likes/views, LWW is generally acceptable, but it's not strictly consistent. During a partition, Region A can accept a like, and Region B can accept a different, conflicting like for the *same* content ID if timestamps are identical or very close. LWW resolves this by picking one, but it's not truly "consistent" in a global sense.
*   **Design B (Geo-Partitioning):** Achieves AP. If a primary region is partitioned, writes to it will succeed, but replication to others will halt. Reads from non-primary regions might be stale until replication catches up.
*   **Design C (Global Log):** Achieves CP. The global log ensures ordering. If a region goes offline, it stops consuming from the log. Once it recovers, it can catch up. However, the log itself must be highly available and tolerant to partitions, which is a complex problem. If the log cluster experiences a partition, writes might be blocked, impacting availability.

**5. Latency Impact Analysis:**

*   **Design A:** Lowest write latency as writes are acknowledged locally. Reads from local replicas are fast. Cross-region reads might experience higher latency.
*   **Design B:** Similar to A, with potential for higher read latency if accessing data owned by a remote primary. Write latency is good for primary writes.
*   **Design C:** Potentially higher write latency due to log replication and consumption. Read latency depends on the state store, but if served from local replicas, it can be low.

**6. Cost Impact Analysis:**

*   **Design A:** High cost due to maintaining active replicas in all regions and complex conflict resolution logic. Potentially more compute for conflict resolution.
*   **B:** Moderate cost. Less complex replication, but may require more sophisticated sharding and rebalancing infrastructure.
*   **C:** High cost. Requires a massively scalable, highly available, and fault-tolerant distributed log system (like Kafka at extreme scale), plus the state stores in each region.

**7. Operational Complexity Comparison:**

*   **A:** High. Implementing and managing CRDTs or vector clocks correctly, especially at scale, is complex. Debugging consistency issues can be difficult.
*   **B:** Moderate. Sharding and rebalancing logic needs careful implementation.
*   **C:** High. Managing a global, highly available distributed log is a significant operational undertaking.

**8. Final Decision with Justification:**

For likes and views, where eventual consistency is acceptable and data loss is unacceptable, **Design C (Global Transaction Log with Replicated State Machines)** is the most robust choice, despite its complexity and potential latency. The strong ordering guarantee from the log makes reconciliation straightforward and ensures durability. We can use Kafka as the global log. The state machines (databases) in each region will store the raw events and aggregated counts.

**9. Residual Risk:**

*   **Kafka Bottleneck:** The global Kafka cluster must be extremely well-provisioned and fault-tolerant. If Kafka itself experiences partitions or performance degradation, writes will be blocked.
*   **Clock Skew:** While Kafka provides ordering within partitions, relying on timestamps for LWW in downstream state stores can still be problematic if clocks are not tightly synchronized.
*   **Consumer Lag:** If a region's consumers cannot keep up with the Kafka log, its local state will lag significantly. This impacts read freshness.
*   **Data Corruption in State Stores:** Although the log is ordered, bugs in the worker logic or database corruption could still lead to inconsistent states in regional databases.

---

### Bottleneck 2: Read Path - Serving Billions of Count Reads Per Day with Low Latency and High Availability Across Regions

**1. Precise Failure Scenario:**

A popular piece of content (e.g., a viral video or breaking news post) suddenly goes viral, attracting an unprecedented number of concurrent viewers and likers. This leads to an extreme spike in read requests for its like/view counts. Simultaneously, one of the major regional data centers experiences a partial network outage, affecting connectivity to its count database and cache. The system must continue serving accurate-enough counts for this popular content globally, even with degraded regional capacity, without overwhelming downstream services or violating latency SLAs.

**2. Why Naive Solution Fails Mathematically:**

*   **Naive Approach:** A single, replicated Redis cluster serving counts, with a cache-aside pattern. When a count is read, check cache; if miss, query the primary DB (e.g., Cassandra), populate cache, and return.
*   **Failure Mode:**
    *   **Cache Stampede/Thundering Herd:** When a count is not in the cache (cache miss), many requests for the same `content_id` will simultaneously hit the database. This can overwhelm the database, causing it to become slow or unavailable, leading to cascading failures. For a viral piece of content, the cache miss rate for its count could be very high.
    *   **Database Overload:** Even if the cache had a high hit rate, a massive surge in QPS for a few viral content IDs can still saturate the database shards responsible for those counts, impacting all read operations.
    *   **Network Partition Impact:** If a region's primary count database becomes unreachable, reads for content primarily stored there will fail or become very slow. Serving stale data from a cache might be an option, but it needs to be managed carefully.
    *   **Stale Data:** With a large read/write ratio, ensuring counts are "fresh enough" is a challenge. If aggregation lags, users might see outdated numbers.

*   **Mathematical Failure:**
    Assume a viral content ID `C` is not in the cache.
    Let `R` be the peak read QPS for `C`'s count.
    Let `DB_R` be the maximum QPS the database shard for `C` can handle.
    If `R > DB_R`, the database will be overloaded.
    If cache TTL is `T_cache`, and cache hit rate drops to `H`, then cache miss rate is `(1-H)`.
    Number of DB requests per second for `C`'s count = `R * (1-H)`.
    If `R * (1-H) > DB_R`, the database shard will fail. For a viral item, `R` can be millions of QPS, and `H` can drop to near 0 during a stampede.

**3. Alternative Designs:**

*   **Design A: Distributed Cache with Cache-Aside and Time-To-Live (TTL)**
    *   **Description:** Use a highly distributed cache like Redis Cluster or Aerospike for counts. Cache counts with a short TTL (e.g., 5-15 seconds). When a read misses the cache, a single "champion" request fetches from the DB, updates the cache, and returns. Other requests for the same item wait for the cache to be populated.
    *   **Pros:** Simple to implement, good performance for hot items when cache is warm.
    *   **Cons:** Susceptible to cache stampedes on miss. TTL might lead to stale data. Database still needs to handle the aggregate read load.

*   **Design B: Tiered Caching with Frontend and Backend Caches, and Rate Limiting**
    *   **Description:**
        *   **Frontend Cache (CDN/Edge):** Serve counts for extremely popular/viral content directly from the CDN if they are relatively stable.
        *   **Backend Cache (Redis Cluster/Aerospike):** For less popular items or when CDN data is stale. Implement cache-aside.
        *   **Rate Limiting:** Apply aggressive rate limiting at the API gateway for count requests. If a specific `content_id` exceeds a threshold, serve cached data (even if stale) or a default/fallback value.
        *   **Database Read Optimization:** Use approximate count queries or specialized read replicas for the count database.
    *   **Pros:** Reduces load on backend services and databases. Provides better control during spikes.
    *   **Cons:** Increased complexity. Stale data is more likely. Requires sophisticated rate limiting logic.

*   **Design C: Real-time Aggregation with Optimized Read Path (Push-based)**
    *   **Description:** Instead of a pull-based cache-aside, use a push-based mechanism. The aggregation service (from the write path) continuously updates the count database. The read path queries this highly optimized, low-latency count database directly. This database can be optimized for fast reads of counters (e.g., using in-memory stores with periodic persistence).
    *   **Pros:** Counts are always fresh or near-fresh. Reduces read load on raw event storage.
    *   **Cons:** Aggregation must keep up with writes. The count database needs to be highly available and performant for reads.

**4. CAP Tradeoff Analysis:**

*   **Design A:** AP. Prioritizes Availability and Partition Tolerance. Consistency is eventually achieved through TTL and cache updates. Cache stampedes can temporarily break consistency.
*   **Design B:** AP. Combines caching strategies for availability and performance. Rate limiting can impact availability for some requests but protects the system.
*   **Design C:** CP for the count database. Prioritizes Consistency and Partition Tolerance for the aggregated counts. Availability of reads depends on the count database's availability.

**5. Latency Impact Analysis:**

*   **Design A:** P95/P99 reads are low when cache hits are high. Spikes to DB latency on cache misses.
*   **Design B:** Low latency for CDN/Edge cached data. Low latency from backend cache. Rate limiting can introduce higher latency for throttled requests.
*   **Design C:** Consistently low latency reads from the optimized count database, provided it's scaled appropriately.

**6. Cost Impact Analysis:**

*   **Design A:** Moderate cost. Requires a large distributed cache cluster.
*   **B:** Higher cost. Involves CDN, large cache cluster, and potentially more complex rate-limiting infrastructure.
*   **C:** Potentially higher cost for the dedicated, highly performant count database, but potentially lower overall cost by reducing load on raw event storage and simplifying read paths.

**7. Operational Complexity Comparison:**

*   **A:** Moderate. Cache management and stampede mitigation are key.
*   **B:** High. Managing CDN, cache tiers, rate limiting policies, and their interactions is complex.
*   **C:** High. Building and operating a highly available, low-latency count database at scale is challenging.

**8. Final Decision with Justification:**

**Design C (Real-time Aggregation with Optimized Read Path)** is the most suitable. This approach leverages the aggregation service from the write path to maintain a dedicated, highly optimized datastore for counts (e.g., Redis Cluster or Aerospike). This avoids the cache stampede problem altogether by having a system optimized for serving counts directly. The aggregation service ensures counts are reasonably fresh. We will use a multi-region strategy where each region has its own count database, served by its regional aggregation workers, and these count databases are replicated. For extremely popular content, we can implement a global secondary cache layer (like Memcached or a distributed cache) specifically for counts to serve the most frequent reads from the nearest location.

**9. Residual Risk:**

*   **Aggregation Lag:** If the aggregation service cannot keep up with writes, counts will be stale.
*   **Count Database Scalability:** The count database must scale to handle millions of QPS and petabytes of aggregated data (if historical counts are kept).
*   **Regional Outages:** If a region's count database is unavailable, reads for content primarily associated with that region will be impacted.
*   **Data Corruption:** Bugs in aggregation logic or the count database itself could lead to incorrect counts.

---

**Performance Envelope Modeling:**

*   **Write Path (Kafka + Cassandra):**
    *   **Degradation Point:** Kafka throughput limits, Cassandra write throughput limits per shard, network bandwidth between regions, and consumer lag from Kafka to Cassandra workers.
    *   **Resource Saturation:** Network bandwidth for cross-region replication, Kafka broker CPU/disk IO, Cassandra node CPU/disk IO/network.
    *   **Predictive Metric:** Kafka consumer lag, Cassandra write latency (P99), and node resource utilization (CPU/Disk IO).

*   **Read Path (Optimized Count DB + Aggregation):**
    *   **Degradation Point:** QPS limits of the count database instances, aggregation pipeline throughput, network bandwidth between aggregation workers and count DB.
    *   **Resource Saturation:** Count database node CPU, network, memory (if in-memory), aggregation worker CPU.
    *   **Predictive Metric:** Count database read latency (P99), aggregation worker CPU utilization, and aggregation lag.

---

## Step 4 — Reliability, Security, and Scale Curve

**SLA/SLO:**

*   **Availability (99.99%):** Achieved through multi-region deployment, redundant services, robust message queuing, and fault-tolerant databases.
*   **Latency (P95/P99):** Handled by tiered caching for reads, optimized count databases, efficient write paths to message queues, and asynchronous processing for raw event storage.
*   **Durability (No Data Loss):** Ensured by durable message queues and replicated, fault-tolerant databases for both raw events and aggregated counts. Idempotency keys prevent duplicate writes.
*   **Consistency Goals:** Eventual consistency for writes and counts. Stronger ordering guarantees via Kafka for raw event processing.
*   **Cost Constraints:** Addressed by using efficient storage (e.g., Cassandra for raw events, optimized DB for counts), horizontal scaling, multi-tenancy in caches, and asynchronous processing to smooth out load.

**Reliability Mechanisms:**

*   **Retries with Backoff:** Implemented at client and service levels for transient network errors.
*   **Circuit Breakers:** Used between services to prevent cascading failures when a downstream service is unhealthy.
*   **Load Shedding:** For critical services under extreme load, selectively drop less important requests or return stale data gracefully.
*   **Backpressure:** Message queues and worker pools naturally provide backpressure. Aggregation workers adapt batch sizes based on performance.
*   **Idempotency Keys:** Used for write operations (likes, views) to ensure exactly-once semantics at the application level, preventing duplicate events from being processed.
*   **Exactly-Once vs. At-Least-Once Tradeoff:**
    *   Raw event writes: Aim for at-least-once from the client to Kafka, and then leverage Kafka's guarantees and worker-side de-duplication (using idempotency keys) to achieve effectively exactly-once processing into the databases.
    *   Count updates: Aggregation workers aim for at-least-once processing from the queue, with the aggregation logic itself being idempotent (e.g., summing events within an immutable window).
*   **Dead Letter Queues (DLQs):** For events that fail processing repeatedly (e.g., malformed data, persistent errors), move them to a DLQ for manual inspection, preventing blockage of the main processing pipeline.

**Security Threat Model:**

*   **DDoS Mitigation:** WAF, edge network protection, rate limiting at API gateways.
*   **Auth Token Abuse:** Secure authentication and authorization mechanisms for API endpoints. Short-lived tokens.
*   **Replay Attacks:** Idempotency keys for writes. Timestamp validation.
*   **Injection Vectors:** Input validation and sanitization for all API parameters. Use parameterized queries for database interactions.
*   **Data Exfiltration:** Encryption at rest and in transit. Strict access control policies. Network segmentation.
*   **Insider Threat Surface:** Principle of least privilege. Auditing of internal access to sensitive data.
*   **Encryption:**
    *   **At Rest:** Encrypt all data in databases and caches.
    *   **In Transit:** TLS/SSL for all client-to-server and server-to-server communication.
*   **Key Rotation:** Regular rotation of encryption keys and service credentials.

**Observability:**

*   **Golden Signals:** Latency, Traffic, Errors, Saturation. Monitored for all services.
*   **High-Cardinality Metrics Strategy:** Use sampling or approximation for metrics like "count per content ID" if cardinality becomes too high. Focus on aggregate metrics (e.g., total QPS, average latency) and use tracing/logging for detailed debugging.
*   **Distributed Tracing:** Essential for understanding request flow across multiple services. Tools like OpenTelemetry.
*   **Structured Logging:** JSON format logs with clear fields for easy querying and analysis.
*   **Alert Fatigue Prevention:** Define clear SLOs and alert only when SLOs are at risk. Use anomaly detection for proactive alerting. Group alerts by service and severity.

**Next 10x Growth:**

*   **Which layer must be partitioned?**
    *   **Raw Event Storage (DB_Like, DB_View):** Already sharded by `content_id` and time/event buckets. Scaling might involve adding more nodes or re-sharding.
    *   **Count Database (DB_Count):** Already sharded, likely by `content_id` or a hash of it. Scaling involves adding more shards/nodes.
    *   **Message Queue (Kafka):** Partitioned by topic and partition key. Scaling involves adding more brokers and partitions.
    *   **Stateless Services (API, Workers):** Horizontally scalable by adding more instances behind load balancers.
*   **When vertical scaling fails:** When a single machine (CPU, RAM, Disk IO, Network) cannot handle the load, even with optimization. This will happen for databases and message queues first.
*   **When to introduce sharding:** Sharding is already introduced based on `content_id` and time. Further sharding might involve dynamic rebalancing or finer-grained partitioning if certain `content_id` ranges become extremely hot.
*   **When to move to event-driven architecture:** We are already heavily event-driven with Kafka for raw events and aggregations. This is a strength.
*   **When to adopt multi-active regions:** We are designing for multi-region from the start with active-active replication for writes and read replicas for reads.
*   **Data Rebalancing Strategy:** For databases like Cassandra, automated rebalancing is built-in. For Kafka, adding partitions and reassigning them is standard. For the count database, a strategy to rebalance `content_id` shards across nodes would be needed if load becomes uneven.
*   **Online Migration Plan:**
    *   Gradually shift traffic from old system to new.
    *   Dual-write to both old and new systems, comparing results.
    *   Migrate data: For raw events, this might involve backfilling from old storage to new. For counts, the aggregation service can rebuild them from raw events.
    *   Cutover read traffic to new system.
    *   Decommission old system.

**Cost Re-evaluation at 10x:**

*   Storage: ~83 PB. Cost would increase by ~10x.
*   Compute: Millions of QPS would scale to tens of millions. Compute costs would increase significantly, likely into the hundreds of millions of dollars annually.
*   Networking: Cross-region replication bandwidth would scale, demanding much higher capacity and cost.
*   **Total Order of Magnitude:** Likely **hundreds of millions to over a billion dollars annually**.

---

## Don't Be Like Jimmy

Jimmy designed a system for likes and views without ever quantifying the load. He assumed a simple cache-aside pattern would handle everything. When a viral post hit, his cache stampede caused a cascading failure, his database melted, and users saw '0 likes' on a trending topic. He also forgot about cross-region replication, leading to data loss during a regional outage. Jimmy learned the hard way that designing for scale requires more than just picking a few popular technologies; it demands a deep understanding of the numbers, the tradeoffs, and the failure modes.

*   **Designing before quantifying:** Leads to systems that break under real-world load, missing critical SLAs. Numbers drive design decisions.
*   **Ignoring CAP tradeoffs:** Leads to systems that are either unavailable when partitions happen or inconsistent in ways that break user trust. Be explicit about your choices (AP vs. CP).
*   **Assuming cache hit rate:** Cache hit rates are dynamic. Design for cache misses and stampedes, not just ideal scenarios.
*   **Ignoring hot partitions:** Viral content will always exist. Design for uneven load distribution and have strategies for hot spots.
*   **Underestimating cross-region latency:** Network partitions and latency are realities. Assume they will happen and design for graceful degradation and efficient reconciliation.
*   **Designing without cost awareness:** Scalability comes with a price. Understand the cost implications of storage, compute, and network for every design decision.
*   **Overengineering early:** Start with a solid, scalable foundation. Don't build complex, multi-region, globally consistent systems if simple replication and eventual consistency will suffice for the initial requirements. Iterate based on measured performance and observed bottlenecks.