---
layout: post
title: How Disney Hotstar (now JioHotstar) Scaled Its Infra for 60 Million Concurrent Users (HLD)
author: jane
date: 2026-02-15 09:00:00
categories: [ disney, HLD, system-design ]
image: assets/images/4.jpg
---

Let's break down how a platform like JioHotstar (formerly Hotstar) handles massive concurrent viewership, which can peak at tens of millions of users. Imagine an interviewer asking you about this.

**Interviewer:** "So, you're tasked with designing a system to support a live streaming service that needs to handle 60 million concurrent users during a major sporting event. How would you approach this?"

**Interviewee:** "That's a significant scale! Before I dive into the design, I have a few clarifying questions to ensure we're aligned on the core requirements."

**Clarifying Questions:**

1.  **User Experience:** What are the critical user journeys we need to support? Primarily video playback, but what about other features like live chat, polls, or user authentication?
2.  **Content Type:** Are we primarily dealing with live streaming, Video on Demand (VOD), or a mix? Live streaming often has different scaling characteristics.
3.  **Geographic Distribution:** Where are these 60 million users located? Global distribution implies CDN strategies and regional data centers.
4.  **Device Types:** What kind of devices will users be accessing from? This impacts bandwidth requirements and client-side handling.
5.  **Latency Requirements:** What's the acceptable latency for critical operations, like starting a stream or responding to a user interaction?
6.  **Peak vs. Average Load:** Is the 60 million concurrent user figure a sustained peak, or does it represent a very short burst? Understanding the ramp-up and ramp-down is crucial.
7.  **New Features:** Are there any new or experimental features being launched during this event that might put additional strain on the system?

**Interviewer:** "Great questions. Let's assume:
*   **Primary focus:** Live streaming of a major cricket match.
*   **User Base:** Primarily concentrated in India, but with a global CDN for international viewers.
*   **Latency:** Low latency for stream start-up and playback is critical. We want users to see the action as it happens.
*   **Peak Load:** The 60 million concurrent users is a sustained peak for a few hours.
*   **Other Features:** Basic authentication and a real-time score update service are also required."

**Functional Requirements:**

*   User authentication and authorization.
*   Stream video content (live and potentially VOD).
*   Provide real-time score updates.
*   Handle high concurrent user load.

**Non-Functional Requirements:**

*   **Availability:** High availability, aiming for 99.99% uptime during the event.
*   **Scalability:** Ability to scale horizontally to handle 60M+ concurrent users.
*   **Latency:** Low latency for stream start-up and playback. Score updates should be near real-time.
*   **Durability:** User session data and playback state should be durable.
*   **Consistency:** Eventual consistency is acceptable for non-critical data like user profiles, but stream state and playback position might require stronger consistency.

---

### High-Level Design: Scaling for Millions of Viewers

Okay, let's sketch out a blueprint for this. The core idea is to distribute the load effectively and ensure each component can scale independently.

**Path of a Request (Simplified):**

1.  **User Request:** A user wants to watch the stream.
2.  **DNS Resolution:** DNS directs the user to the nearest CDN edge server or a regional load balancer.
3.  **CDN:** For static assets (UI, player) and potentially video segments, the CDN serves them efficiently.
4.  **Load Balancer:** Distributes incoming API requests (authentication, stream initiation, score updates) across application servers.
5.  **Application Servers:** Handle business logic, user authentication, stream session management, and fetching data.
6.  **Caching Layer:** Stores frequently accessed data (user profiles, stream metadata) to reduce database load.
7.  **Database:** Stores persistent user data, stream configurations, and potentially session information.
8.  **Streaming Servers/Media Servers:** Deliver the actual video segments to the user's player. These are specialized for high-throughput media delivery.
9.  **Real-time Score Service:** A dedicated service for delivering score updates, likely using WebSockets or similar low-latency push mechanisms.

**Core Components & Choices:**

*   **CDN (Content Delivery Network):** Essential for delivering static content and video segments globally with low latency. This offloads a massive amount of traffic from our origin servers.
*   **Global Load Balancers (e.g., AWS Route 53, Cloudflare):** To route users to the closest healthy region or data center.
*   **Regional Load Balancers (e.g., ALB, NLB):** Distribute traffic within a data center or region to application servers.
*   **API Gateway/Edge Proxy (e.g., Envoy, Nginx):** A central point for managing API requests, rate limiting, authentication, and routing to microservices.
*   **Application Servers (Microservices):** Stateless services responsible for user management, authentication, stream session management, and orchestrating requests. We'd likely use containerization (e.g., Kubernetes) for easy scaling and management.
*   **Caching Layer (e.g., Redis, Memcached):** To cache frequently accessed data like user session details, stream metadata, and popular content information. This drastically reduces latency and database load.
*   **Database (e.g., PostgreSQL, Cassandra):** For persistent storage. Given the scale, a horizontally scalable NoSQL database like Cassandra might be suitable for session data, while a relational DB could handle user profiles and configurations. Read replicas would be crucial.
*   **Streaming Servers (e.g., Nginx RTMP, Wowza, custom media servers):** Optimized for serving video segments (HLS/DASH). These need massive bandwidth and efficient I/O.
*   **Real-time Score Service (e.g., using WebSockets, Kafka + WebSockets):** To push score updates instantly. Kafka can buffer these updates, and a WebSocket service can fan them out to connected clients.

**High-Level Architecture Diagram:**

```mermaid
graph TD
    User[User/Client] --> DNS[DNS Resolution]
    DNS --> CDN[CDN Edge Servers]
    CDN --> User
    DNS --> GLB[Global Load Balancer]
    GLB --> RLB[Regional Load Balancer]
    RLB --> APIGW[API Gateway / Edge Proxy]

    APIGW --> AuthSvc[Auth Service]
    APIGW --> StreamSvc[Stream Mgmt Service]
    APIGW --> ScoreSvc[Score Update Service]

    AuthSvc --> UserDB[(User Database)]
    StreamSvc --> StreamMetaDB[(Stream Metadata DB)]
    StreamSvc --> SessionCache[Session Cache (Redis)]
    ScoreSvc --> Kafka[Kafka Cluster]

    Kafka --> ScoreFanout[Score Fan-out Service (WebSockets)]
    ScoreFanout --> User

    StreamSvc --> MediaServers[Media Servers (HLS/DASH)]
    MediaServers --> User

    %% Internal Dependencies
    AuthSvc --> SessionCache
    StreamSvc --> SessionCache
    StreamSvc --> StreamMetaDB
```

**Jimmy's Anti-Pattern:** A common mistake here is to try and build a single, monolithic application that does everything. While simple initially, it becomes a massive bottleneck for scaling and deployment. Another is relying solely on a single database instance for all read/write operations, which will quickly buckle under this load.

---

### Deep Dive: Scaling the Core Services

Let's zoom into two critical areas: **Auto-Scaling for API Servers** and **Handling Real-time Score Updates**.

**1. Auto-Scaling API Servers**

*   **Challenge:** We need to dynamically adjust the number of API servers (Auth, Stream Mgmt) based on incoming request volume to handle 60M users without over-provisioning.
*   **Strategy:** Kubernetes Horizontal Pod Autoscaler (HPA) is our go-to tool.
    *   **Metrics:** We'll monitor CPU utilization and potentially custom metrics like "requests per second per pod" or "active stream sessions per pod."
    *   **Target:** Define a target CPU utilization (e.g., 70%) or RPS per pod. When metrics exceed this, HPA will automatically increase the number of pods. When they drop, it scales them down.
    *   **Node Scaling:** Complement HPA with cluster autoscaler (e.g., Karpenter for EKS) to ensure there are enough underlying nodes (VMs/EC2 instances) to run the scaled-up pods.
    *   **Pre-warming:** For predictable spikes (like the start of a match), we can use scheduled scaling or proactive scaling based on historical data to pre-warm the cluster *before* the peak hits, minimizing cold starts. This involves pre-allocating nodes and ensuring application pods are ready.
    *   **Pod Anti-Affinity:** Configure Kubernetes to spread pods across different nodes and availability zones to prevent a single node failure from taking down a significant portion of our API capacity.

**2. Real-time Score Updates (Kafka + WebSockets)**

*   **Challenge:** Delivering score updates to potentially millions of connected users simultaneously with minimal delay.
*   **Architecture:**
    *   **Ingestion:** The score update service (likely receiving data from a dedicated feed or match engine) publishes score changes as messages to a Kafka topic.
    *   **Kafka:** Acts as a highly scalable, durable buffer. We'd partition the Kafka topic logically (e.g., by match ID or even by user segment if needed) to distribute the load.
    *   **Score Fan-out Service:** A fleet of services responsible for consuming from Kafka and pushing updates to connected clients via WebSockets.
        *   **Scaling:** This service needs to scale horizontally based on the number of active WebSocket connections and the rate of incoming Kafka messages.
        *   **Connection Management:** Each service instance manages thousands of persistent WebSocket connections. Careful connection pooling and management are key.
        *   **Fan-out Logic:** When a new score update arrives from Kafka, the fan-out service broadcasts it to all connected clients interested in that specific match.
*   **Consistency:** Kafka provides at-least-once delivery. The fan-out service might need logic to handle potential duplicates if the client doesn't acknowledge receipt, but for score updates, slight duplication is often acceptable or handled by the client simply processing the latest value.
*   **Back-of-the-Envelope Estimation:**
    *   **API Servers:** If each API server pod handles, say, 10,000 RPS and we need to serve 500,000 RPS peak for API requests (authentication, stream setup), we'd need around 50 API server pods. With buffer, maybe 70-100 pods.
    *   **Kafka:** Need enough brokers and partitions to handle the write load from the score service and the read load from the fan-out service. If scores update every few seconds, and we have millions of users, Kafka needs to be robust.
    *   **WebSocket Connections:** If 80% of users (48 million) are actively watching, and each connection is relatively lightweight, we might need millions of concurrent WebSocket connections. The fan-out service needs to scale to manage this, perhaps with 1000s of instances.

---

### Future Improvements and Bottlenecks

*   **Monitoring & Alerting:** Comprehensive monitoring across all services is paramount. Metrics for request latency, error rates, CPU/memory usage, Kafka lag, WebSocket connection counts, and CDN cache hit ratios are essential. Alerts should trigger auto-scaling or notify on-call engineers.
*   **Rate Limiting:** Implement robust rate limiting at the API Gateway to protect backend services from traffic spikes or abuse.
*   **Graceful Degradation:** If certain services are overloaded, the system should degrade gracefully (e.g., disable non-critical features like chat temporarily) rather than fail completely.
*   **Database Sharding:** For massive datasets, the database will likely need sharding to distribute data and load across multiple instances.
*   **Caching Strategies:** Fine-tune cache invalidation and TTLs to balance freshness and performance. Consider distributed caching solutions.
*   **Chaos Engineering:** Proactively inject failures (e.g., kill pods, introduce latency) in a controlled environment to test resilience and auto-scaling mechanisms before a live event.
*   **A/B Testing:** For new features or optimizations, use A/B testing to roll them out gradually and measure impact.

This covers the foundational design. The real magic happens in the continuous tuning, monitoring, and iterative improvements based on real-world performance data.