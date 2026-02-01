---
layout: post
title: Foundations Vertical vs Horizontal Scaling - When to upgrade the CPU vs adding more nodes (HLD)
author: jane
date: 2026-01-31 09:00:00
categories: [ foundations, HLD, system-design ]
image: /assets/images/2026-01-31-foundations-vertical-vs-horizontal-scaling-when-to-upgrade-the-cpu-vs-adding-more-nodes-hld-diagram-1.png
---

Let's talk about scaling. As systems grow, they inevitably hit performance limits. The question then becomes: do we make individual servers more powerful, or do we add more servers? This is the core of vertical versus horizontal scaling.

Imagine you're building a popular online store. Initially, one powerful server might handle all your traffic. But as your user base explodes, that single server starts to buckle under the load.

---

### Understanding the Demand and Defining Our Goal

**Interviewer:** "So, we've got this e-commerce platform, and traffic is through the roof. We're seeing response times creep up, and some users are experiencing errors during peak hours. We need a solid plan to handle this. What's your initial approach?"

**You:** "That's a classic scaling challenge. Before diving into solutions, I'd want to understand the specifics. Could you tell me more about the expected user growth over the next year? What are the peak traffic patterns – are they daily, weekly, seasonal? What kind of operations are users performing? Are they mostly read-heavy (browsing products) or write-heavy (placing orders, updating profiles)?"

**Interviewer:** "Good questions. We're projecting a 3x increase in daily active users within 12 months, with peak traffic during holiday seasons potentially being 5x our current average. Users are primarily browsing, but checkout operations are critical and need to be extremely fast. We also have a recommendation engine that runs in the background."

**You:** "Got it. And what are our performance targets? Specifically, what's the acceptable latency for a typical user request, say, loading a product page or completing a checkout? What about availability – are we aiming for 99.9%, 99.99%?"

**Interviewer:** "Product page load should ideally be under 500ms. Checkout completion needs to be under 200ms, with very low error rates. For availability, we're targeting 99.95%."

**You:** "Excellent. And are there any specific constraints we need to consider, like budget, existing infrastructure, or specific technology stack preferences?"

**Interviewer:** "Budget is a factor, of course. We're currently running on a single, beefy virtual machine. We'd prefer to leverage cloud-native services if possible, but we're open to solutions that offer the best long-term value."

**You:** "Understood. Now, to avoid common pitfalls, let's steer clear of the 'over-provisioning everything from day one' approach. That's an expensive anti-pattern. We also want to avoid relying solely on a 'single, massive database' without a clear strategy for read replicas or sharding, which can become a bottleneck quickly."

---

### High-Level Design: The Blueprint for Scalability

Based on this, we need a system that can handle increased load gracefully, ensure high availability, and maintain low latency for critical operations. We'll aim for a distributed architecture that allows us to scale components independently.

Here's a high-level blueprint:

1.  **User Access & Traffic Distribution:**
    *   **DNS:** Resolves the domain name to the nearest edge location for faster initial connection.
    *   **CDN (Content Delivery Network):** Caches static assets (images, CSS, JS) closer to users, reducing latency and offloading the web servers.
    *   **Load Balancer:** Distributes incoming user traffic across multiple instances of our application servers. This is crucial for horizontal scaling. It also provides a single entry point and can handle SSL termination.

2.  **Application Tier:**
    *   **API Servers (Web Servers):** These are the workhorses that handle user requests. We'll run multiple instances of these. Each instance will be stateless to allow easy scaling up or down. They'll communicate with various backend services.

3.  **Data & Service Tier:**
    *   **Cache (e.g., Redis, Memcached):** For frequently accessed data (like popular product details, user sessions), a cache significantly reduces the load on the database and speeds up responses.
    *   **Database:** We'll likely need a primary database for transactional data (orders, user accounts). To handle read load, we'll implement read replicas. For extremely high write volumes or very large datasets, sharding might be considered later.
    *   **Recommendation Service:** A dedicated service that handles the recommendation engine. This can be scaled independently based on its resource needs.
    *   **Message Queue (e.g., Kafka, RabbitMQ, SQS):** For asynchronous tasks like order processing, sending emails, or updating inventory. This decouples services and prevents failures in one service from cascading.

Let's visualize the data flow:

<img src="/assets/images/2026-01-31-foundations-vertical-vs-horizontal-scaling-when-to-upgrade-the-cpu-vs-adding-more-nodes-hld-diagram-1.png" alt="System Architecture Diagram 1" style="max-width: 100%; height: auto; display: block; margin: 20px auto;" />

**Component Choices:**

*   **Load Balancer:** Essential for distributing traffic and achieving horizontal scalability. Cloud providers offer managed load balancers (e.g., AWS ELB, Google Cloud Load Balancing) which are highly available and scalable.
*   **API Servers:** Stateless application instances running on virtual machines or containers (like Docker/Kubernetes). This allows us to easily add or remove instances based on demand.
*   **Cache:** Redis is a popular choice due to its performance, flexibility (data structures), and features like persistence and replication. It significantly reduces database load.
*   **Database:** For transactional data, a relational database like PostgreSQL or MySQL is a standard choice. Implementing read replicas is key for scaling read operations.
*   **Message Queue:** Kafka is excellent for high-throughput, durable event streaming, suitable for order processing and real-time data. SQS or RabbitMQ are simpler alternatives for more traditional queuing needs.
*   **Recommendation Service:** This could be a separate microservice, allowing independent scaling and technology choices if needed.

---

### Deep Dive: Tackling Complexity

Let's zoom into two critical areas: the **Cache** and the **Message Queue**.

**1. Caching Strategy: Reducing Database Load**

*   **Problem:** Hitting the primary database for every product page view or user session lookup is inefficient and a major scaling bottleneck.
*   **Solution:** Implement a caching layer.
    *   **Cache Invalidation:** This is the tricky part. When data in the database changes (e.g., product price update, user profile edit), the corresponding cache entry needs to be updated or removed.
        *   **Write-Through Cache:** Write data to the cache *and* the database simultaneously. This ensures consistency but adds latency to writes.
        *   **Write-Behind Cache:** Write to the cache immediately, and then asynchronously write to the database. This is faster for writes but can lead to data loss if the cache fails before writing to the DB.
        *   **Cache-Aside (Lazy Loading):** Application checks the cache first. If data is found (cache hit), it's returned. If not (cache miss), it fetches from the DB, returns it to the user, *and* stores it in the cache for future requests. This is a common and effective pattern.
    *   **Eviction Policies:** When the cache is full, we need a policy to decide which items to remove. Common ones include LRU (Least Recently Used), LFU (Least Frequently Used), and FIFO (First-In, First-Out). For our e-commerce site, LRU is often a good starting point for product data.
    *   **Back-of-the-Envelope Estimation:**
        *   Assume 100,000 QPS (Queries Per Second) on average, with peaks of 500,000 QPS.
        *   If 80% of requests are cache hits, that's ~400,000 QPS served by the cache.
        *   If each cache entry (e.g., product details) is ~1KB, we'd need ~400GB of cache storage. This suggests a cluster of Redis nodes.
*   **CAP Theorem Considerations:** When using a distributed cache like Redis Cluster, we often prioritize Availability (A) and Partition Tolerance (P) over strong Consistency (C), especially for read operations. We might accept slightly stale data for a brief period if a cache node fails, rather than making the entire system unavailable.

**2. Message Queue: Decoupling and Asynchronous Processing**

*   **Problem:** A spike in orders could overwhelm the order processing service, leading to timeouts or errors. Sending emails synchronously also adds latency to user-facing requests.
*   **Solution:** Use a message queue.
    *   **Publish/Subscribe Model:** When an order is placed, the API server publishes an "Order Placed" event to a Kafka topic.
    *   **Consumers:** Multiple worker services (Order Processing Workers, Email Service Workers) subscribe to this topic. Each worker processes messages independently.
    *   **Deduplication:** To prevent duplicate processing (e.g., charging a customer twice), messages should have unique IDs. Consumers can track processed IDs (e.g., in a separate Redis set) and ignore duplicates.
    *   **Retries:** If a worker fails to process a message, it should be retried. A common pattern is exponential backoff for retries. Dead-letter queues (DLQs) can be used for messages that repeatedly fail.
    *   **Back-of-the-Envelope Estimation:**
        *   Assume 10,000 orders per second during peak.
        *   Each order message might be ~5KB.
        *   This requires a Kafka cluster capable of handling ~50 MB/s of data ingress, plus storage for retention.
*   **Consistency Models:** Message queues often offer different consistency guarantees. Kafka, for example, provides strong ordering and durability within a partition. The overall system's consistency will depend on how consumers handle messages (e.g., using transactional writes to the database).

---

### Identifying Bottlenecks and Future Improvements

As we scale, here are some areas we'll need to monitor and potentially address:

*   **Database as a Bottleneck:** Even with read replicas, the primary database can become a write bottleneck. Sharding the database (partitioning data across multiple database instances) would be the next step for extreme write scaling.
*   **Cache Staleness:** Implementing robust cache invalidation strategies is crucial.
*   **Message Queue Throughput:** Ensuring our Kafka cluster or other queueing system can handle the message volume is key. Monitoring consumer lag is vital.
*   **Service Dependencies:** As we introduce more microservices, managing their interactions and dependencies becomes complex. A Service Mesh (like Istio or Linkerd) could help with observability, traffic management, and security.
*   **Monitoring & Alerting:** Comprehensive monitoring of all components (CPU, memory, network, latency, error rates) is non-negotiable. Setting up alerts for key metrics will allow us to proactively address issues.
*   **Graceful Degradation:** What happens if the recommendation service is slow? Can the system still function, perhaps without recommendations, rather than failing entirely? Implementing circuit breakers and fallback mechanisms is important.
*   **Cost Optimization:** As we scale up, monitoring cloud costs and optimizing resource utilization will be critical.

This approach allows us to scale horizontally by adding more instances of our API servers, cache nodes, or worker instances as demand grows, ensuring our system remains performant and available.