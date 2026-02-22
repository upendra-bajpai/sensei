---
layout: post
title: How Facebook & YouTube Handle BILLIONS of Likes & Views (DESIGN)
author: jane
date: 2026-02-22 09:00:00
categories: [ facebook, DESIGN, system-design ]
image: assets/images/4.jpg
---

Let's dive into how massive platforms handle billions of likes and views.

### Step 1 - Understand the Problem and Establish Design Scope

**Simulated Dialogue:**

**Interviewer:** Imagine we're building a system to track "likes" for content on a global social media platform. We're expecting an astronomical number of users and interactions. What are the primary requirements you'd consider for such a system?

**Candidate:** Okay, that's a massive scale! My first thought goes to the sheer volume.

**Interviewer:** Exactly. So, let's break that down. What are your functional requirements?

**Candidate:** Functionally, we need to be able to record a "like" for a specific piece of content by a specific user. We also need to be able to retrieve the total count of likes for any given piece of content. And, importantly, we should be able to see which users have liked a particular piece of content, though maybe not all of them if the list gets too long.

**Interviewer:** Good. Now, what about the non-functional aspects? Think about performance, availability, and how many users we're talking about.

**Candidate:** For non-functional requirements, the most critical ones are:

*   **Scale:** We're talking about billions of users and potentially trillions of pieces of content. Likes could be in the hundreds of billions, maybe even trillions.
*   **Latency:**
    *   **Write Latency (Liking):** This needs to be extremely low. Users expect their "like" to register almost instantly. Let's aim for sub-100ms.
    *   **Read Latency (Counting Likes):** This also needs to be fast, especially for displaying like counts on content feeds. Aim for sub-200ms.
    *   **Read Latency (User Likes):** If we need to retrieve a list of users who liked something, this might be a bit slower, perhaps a few seconds, as it's less critical for real-time display.
*   **Availability:** The system must be highly available. Users should always be able to like content and see counts, even during peak traffic or failures. Aim for 99.999% availability.
*   **Durability:** Likes must not be lost. Even if a server fails, the recorded likes must be preserved.
*   **Consistency:** For like counts, we're likely aiming for eventual consistency. It's okay if the count is slightly stale for a few seconds, but it should eventually be accurate. For the act of liking itself, we need strong consistency to avoid duplicate likes from the same user.

**Interviewer:** Excellent breakdown. Now, let's do a quick back-of-the-envelope calculation to get a sense of the scale. If we have 1 billion active users and each user likes an average of 10 pieces of content per day, what's the QPS for likes? And how much storage would we need for, say, 5 years of data?

**Candidate:** Alright, let's crunch some numbers.

*   **Daily Likes:**
    $1 \text{ billion users} \times 10 \text{ likes/user/day} = 10 \text{ billion likes/day}$

*   **Queries Per Second (QPS) for Likes:**
    Assuming 10 billion likes spread over 24 hours (86,400 seconds):
    $QPS_{write} = \frac{10 \times 10^9 \text{ likes}}{86,400 \text{ seconds}} \approx 115,740 \text{ QPS}$

    Let's round this up to **150,000 QPS** for writes to be safe, considering peak traffic.

*   **QPS for Reading Like Counts:**
    If we assume that for every 10 writes, there's 1 read for a like count (e.g., when a feed is loaded), then:
    $QPS_{read\_count} \approx \frac{150,000 \text{ QPS}}{10} \approx 15,000 \text{ QPS}$

*   **Storage for Likes:**
    Let's assume each like record stores `user_id` (8 bytes), `content_id` (8 bytes), and a timestamp (8 bytes). Total per like: 24 bytes.
    Data per year: $10 \times 10^9 \text{ likes/day} \times 365 \text{ days/year} \times 24 \text{ bytes/like} \approx 87.6 \text{ TB/year}$
    For 5 years: $87.6 \text{ TB/year} \times 5 \text{ years} \approx 438 \text{ TB}$

    This is just for the raw like records. If we also store aggregated counts, that adds more. Let's budget for **500 TB** for raw like data, plus additional space for counts and indices.

*   **Bandwidth:**
    For writes: $150,000 \text{ QPS} \times 24 \text{ bytes/like} \approx 3.6 \text{ MB/s}$ (This seems low, but it's just the data payload. Network overhead will increase this significantly).
    For reads (counts): $15,000 \text{ QPS} \times 8 \text{ bytes/count} \approx 0.12 \text{ MB/s}$ (again, payload only).

    The actual bandwidth will be much higher due to network protocols, replication, and potential fan-out for reads. We should anticipate several Gbps of traffic.

**Interviewer:** That gives us a solid foundation. We're looking at a high-throughput, low-latency, highly available system.

### Step 2 - Propose High-Level Design (HLD) and Get Buy-In

**Interviewer:** Given these requirements, how would you sketch out a high-level design? What are the main components and how do they interact?

**Candidate:** I'd start with a layered approach. At the edge, we'll have load balancers to distribute traffic. Then, we'll have API servers that handle incoming like requests and requests for like counts.

**API Definition:**

*   `POST /v1/like`
    *   **Request Body:** `{ "user_id": "...", "content_id": "..." }`
    *   **Response:** `200 OK` or `201 Created` on success, appropriate error codes.
*   `GET /v1/content/{content_id}/likes/count`
    *   **Response:** `{ "count": 12345 }`
*   `GET /v1/content/{content_id}/likers`
    *   **Query Parameters:** `limit=<int>`, `offset=<int>`
    *   **Response:** `{ "users": ["user_id_1", "user_id_2", ...], "total": 12345 }`

**Architecture Diagram:**

```mermaid
graph LR
    User[User/Client] --> LB[Load Balancer]
    LB --> API[API Servers]
    API --> Cache[Distributed Cache (e.g., Redis Cluster)]
    API --> LikeDB[(Like Data Store)]
    API --> CountDB[(Like Count Store)]
    Worker[Background Workers] --> LikeDB
    Worker --> CountDB
    Worker --> Notif[Notification Service]
```

**High-Level Flow:**

When a user likes a piece of content, the request first hits the **Load Balancer**. It's then routed to one of the **API Servers**. The API server needs to perform a couple of critical actions: first, record the actual "like" event to ensure durability and prevent duplicates. Second, it needs to update the like count for that content.

For the "like" event itself, we need a durable store. A distributed database, perhaps a NoSQL solution optimized for writes, would be suitable here. Let's call this the **Like Data Store**. To prevent duplicate likes from the same user for the same content, we'd likely use a unique constraint on `(user_id, content_id)` in this store.

For the like count, updating it with every single like request can become a bottleneck. A more scalable approach is to use a separate **Like Count Store**. This could be a distributed key-value store or a specialized counter service. The API server would increment the counter in this store.

To handle the high write volume and ensure low latency, we can offload the actual aggregation and potential fan-out of like information to **Background Workers**. These workers can periodically read from the Like Data Store, aggregate counts, and update the Count Store. They can also handle generating notifications if a user's content gets a new like.

For reading like counts, we'd primarily query the **Like Count Store**. For fast access, this store could be backed by a distributed cache. If the count isn't in the cache, we fetch it from the Count Store and populate the cache.

Retrieving the list of users who liked a piece of content would involve querying the **Like Data Store**, potentially with pagination. This is a less frequent operation and can tolerate slightly higher latency.

**Interviewer:** This seems like a good starting point. We've separated concerns for recording individual likes and managing aggregate counts.

### Step 3 - Design Deep Dive & Low-Level Design (LLD)

**Interviewer:** Let's drill down into the challenges. What are the two biggest technical hurdles you foresee with this design, and how would you address them?

**Candidate:** The two most critical challenges here are:

1.  **Handling Write Throughput and Durability for Likes:** The sheer volume of incoming likes (150,000 QPS) puts immense pressure on the `Like Data Store`. We need a solution that can ingest these writes reliably without dropping any data, while also being able to handle potential spikes.
2.  **Maintaining Accurate and Low-Latency Like Counts:** Updating a global counter for every like can be a bottleneck. We need a strategy that keeps counts relatively fresh without overwhelming the system, especially when multiple users are liking the same content simultaneously.

**Technical Challenges & Trade-offs:**

| Goal/Problem                                    | Technique/Solution