---
layout: post
title: How Disney Hotstar (now JioHotstar) Scaled Its Infra for 60 Million Concurrent Users (LLD)
author: jane
date: 2026-02-15 09:00:00
categories: [ disney, LLD, system-design ]
image: assets/images/4.jpg
---

Let's break down how a platform like JioHotstar might architect its infrastructure to handle massive concurrent viewership, drawing parallels to the challenges of scaling.

## Understanding the Scale: 60 Million Concurrent Users

The core requirement is to serve live streaming content to an enormous, fluctuating audience. This means:

*   **Massive Throughput:** Handling millions of simultaneous connections and data streams.
*   **Low Latency:** Minimizing buffering and ensuring a smooth viewing experience.
*   **High Availability:** The system must remain operational during peak demand, like during a major sporting event.
*   **Dynamic Scaling:** The infrastructure needs to scale up and down rapidly in response to user traffic.
*   **Geographic Distribution:** Users are spread across different regions, requiring content delivery to be optimized globally.

## Core Components and Their Responsibilities

To manage this scale, we'll need a layered approach, breaking down the problem into manageable services.

### Content Delivery Network (CDN) & Edge Caching

This is the first line of defense for delivering content efficiently.

*   **Responsibility:** Caching popular video segments geographically closer to users.
*   **Key Objects:**
    *   `CDNEdgeServer`: Represents a node in the CDN network.
    *   `CacheManager`: Manages the cache storage and retrieval logic on an edge server.
    *   `ManifestGenerator`: Creates or retrieves manifest files (e.g., HLS or DASH) that guide clients on how to fetch video segments.

### Load Balancing and Traffic Management

Distributing incoming user requests efficiently across available backend services.

*   **Responsibility:** Directing user connections to the appropriate origin servers or API gateways.
*   **Key Objects:**
    *   `GlobalLoadBalancer`: Handles routing traffic across different regions or data centers.
    *   `RegionalLoadBalancer`: Distributes traffic within a specific geographic region.
    *   `ServiceLoadBalancer`: Manages load balancing for specific microservices.
    *   `HealthChecker`: Monitors the health of backend services and removes unhealthy instances from the pool.

### API Gateway / Edge Proxy Layer

A crucial entry point for client requests, handling authentication, rate limiting, and request routing.

*   **Responsibility:** Acting as a unified entry point, abstracting backend services, and enforcing policies.
*   **Key Objects:**
    *   `APIGateway`: The main entry point for all client requests.
    *   `AuthenticationService`: Verifies user credentials or tokens.
    *   `AuthorizationService`: Checks if the authenticated user has permission to access the requested content.
    *   `RateLimiter`: Protects backend services from overload.
    *   `RequestRouter`: Directs incoming requests to the appropriate backend microservices.

### User and Session Management

Handling user authentication, session state, and preferences.

*   **Responsibility:** Storing and retrieving user session data, like current playback position, subscriptions, and device information.
*   **Key Objects:**
    *   `UserManager`: Manages user profiles and authentication.
    *   `SessionManager`: Manages active user sessions, potentially using a distributed cache like Redis for low-latency access.
    *   `UserSession`: Represents an active user session.

### Video Streaming Services

The core services that fetch and deliver video segments.

*   **Responsibility:** Retrieving video data from storage and serving it to users, often broken into segments.
*   **Key Objects:**
    *   `VideoStreamService`: Handles requests for video streams.
    *   `SegmentFetcher`: Retrieves individual video segments from storage.
    *   `ManifestService`: Generates or retrieves playlist/manifest files (HLS, DASH).
    *   `ContentStorage`: Represents the underlying storage for video files (e.g., S3, object storage).

### Orchestration and Scaling (Kubernetes)

Managing the deployment, scaling, and lifecycle of microservices.

*   **Responsibility:** Ensuring that the right number of service instances are running and healthy.
*   **Key Objects:**
    *   `KubernetesCluster`: Represents a managed Kubernetes environment.
    *   `Pod`: The smallest deployable unit in Kubernetes, containing one or more containers.
    *   `Deployment`: Manages the rollout and scaling of Pods.
    *   `HorizontalPodAutoscaler (HPA)`: Automatically scales the number of Pods based on observed metrics (e.g., CPU utilization).
    *   `NodeScaler`: Manages the underlying compute instances (nodes) in the cluster.

## Interaction Flow: User Request for a Video Segment

Let's trace a typical request:

1.  **Client Request:** A user's device (e.g., a smart TV or mobile app) requests a video stream.
2.  **CDN Edge:** The request first hits a nearby CDN edge server. If the manifest or popular segments are cached, they're served directly. If not, the CDN forwards the request.
3.  **Global Load Balancer:** The request is routed to the most appropriate regional load balancer.
4.  **Regional Load Balancer:** This distributes the request to an instance of the `APIGateway`.
5.  **API Gateway:**
    *   The `APIGateway` receives the request.
    *   It invokes the `AuthenticationService` to validate the user's session token.
    *   If authenticated, it might check with the `AuthorizationService` to ensure the user can view the requested content.
    *   It then uses the `RequestRouter` to determine which `VideoStreamService` instance should handle this request.
6.  **VideoStreamService:**
    *   The `VideoStreamService` receives the request.
    *   It might interact with the `SessionManager` to retrieve or update user playback state.
    *   It then calls the `SegmentFetcher` to get the specific video segment from `ContentStorage`.
    *   The `SegmentFetcher` might retrieve the segment from a distributed cache (like Redis) if available, or directly from object storage.
7.  **Response:** The video segment is streamed back through the layers to the client.

## Designing for Scale: Key Patterns

To handle 60 million concurrent users, several architectural patterns are essential:

### Microservices Architecture

Breaking down the monolithic application into smaller, independent services (e.g., `UserService`, `StreamService`, `BillingService`). This allows for:

*   **Independent Scaling:** Each service can be scaled based on its specific load.
*   **Technology Diversity:** Different services can use the best technology for their job.
*   **Fault Isolation:** Failure in one service is less likely to bring down the entire system.

### Event-Driven Architecture (EDA)

Using events to communicate between services, especially for asynchronous tasks.

*   **Use Case:** When a user completes a viewing session, an event can be published to update viewing history, trigger recommendations, or manage billing.
*   **Pattern:** Publish-Subscribe (Pub/Sub) with a message broker like Kafka.
*   **Objects:**
    *   `EventPublisher`: Publishes events to the message broker.
    *   `MessageBroker` (e.g., Kafka): Facilitates asynchronous communication.
    *   `EventListener`: Subscribes to events and performs actions.

### Caching Strategy

Aggressively caching data at various layers to reduce latency and load on backend services.

*   **Types:** CDN caching, in-memory caches (Redis, Memcached) for session data and frequently accessed metadata, database query caching.
*   **Pattern:** Cache-Aside. When data is requested, the application first checks the cache. If it's not there, it fetches from the source, stores it in the cache, and then returns it.

### Auto-Scaling and Kubernetes

Kubernetes is the de facto standard for orchestrating containerized applications at scale.

*   **Pattern:** Horizontal Pod Autoscaling (HPA).
    *   **How it works:** HPA monitors metrics like CPU and memory usage of pods. When these metrics exceed a defined threshold, Kubernetes automatically creates more replicas (pods) of the service. When metrics drop, it scales down.
    *   **Low-level Design:**
        *   `Deployment` objects define the desired state for Pods.
        *   `HorizontalPodAutoscaler` resources are configured with target metrics (e.g., `targetCPUUtilizationPercentage`).
        *   The Kubernetes control plane (specifically the `metrics-server` and `kube-controller-manager`) continuously evaluates these metrics and adjusts the `replicas` count in the `Deployment`.
    *   **Pseudo-code/Interface:**
        ```go
        // Example HPA configuration (conceptual)
        type HorizontalPodAutoscaler struct {
            Name string
            ScaleTargetRef Deployment // Reference to the Deployment to scale
            MinReplicas int
            MaxReplicas int
            Metrics []MetricSpec // List of metrics to scale on
        }

        type MetricSpec struct {
            Type string // e.g., "Resource", "Custom", "Object"
            Resource *ResourceMetricSource // for CPU/Memory
            // ... other metric types
        }

        type ResourceMetricSource struct {
            Name string // "cpu" or "memory"
            TargetAverageUtilization int // e.g., 70 for 70%
        }
        ```

### Load Balancing Strategies

Beyond basic round-robin, consider:

*   **Least Connections:** Sending traffic to the server with the fewest active connections.
*   **Weighted Round Robin:** Assigning different weights to servers based on their capacity.
*   **Geographical Routing:** Directing users to the closest data center.

## Refinement and Edge Cases

### Concurrency Control

*   **Database Transactions:** For critical operations (e.g., user registration, subscription changes), use ACID-compliant transactions.
*   **Optimistic Concurrency:** For high-volume read-heavy operations where data contention is low, use versioning or ETags to detect and handle conflicts during updates.
*   **Distributed Locking:** For operations that require exclusive access to a shared resource across multiple services or instances, use distributed locks (e.g., via ZooKeeper, etcd, or Redis with Redlock).

### Failure Handling

*   **Idempotency:** Design API endpoints to be idempotent. This means that making the same request multiple times has the same effect as making it once. This is crucial for handling retries after network failures.
    *   **Pattern:** Use unique idempotency keys in requests. The server stores the key and the result of the first successful operation. Subsequent requests with the same key return the cached result.
    *   **Interface Example:**
        ```java
        // Request object with idempotency key
        public class UserRequest {
            String userId;
            String idempotencyKey; // e.g., UUID
            // ... other fields
        }

        // Service method
        public UserResponse processUserRequest(UserRequest request) {
            // Check if idempotencyKey exists in a cache/DB
            // If yes, return cached response
            // If no, perform operation, store result with key, then return
        }
        ```
*   **Circuit Breakers:** Prevent cascading failures. If a downstream service is consistently failing, the circuit breaker "opens," and subsequent calls to that service fail fast, returning an error without even attempting the network call.
    *   **Pattern:** Inspired by electrical circuit breakers.
    *   **States:** Closed (normal operation), Open (failing, blocking requests), Half-Open (periodically allows a test request to see if the service has recovered).
*   **Retries with Exponential Backoff:** When a service call fails transiently, retry the operation after a delay. Exponential backoff increases the delay between retries (e.g., 1s, 2s, 4s, 8s) to avoid overwhelming a struggling service.
*   **Graceful Degradation:** If certain non-critical features fail (e.g., personalized recommendations), the system should continue to serve core functionality (e.g., video playback).

### Data Management

*   **Database Sharding:** Distribute data across multiple database instances to handle larger datasets and higher throughput.
*   **Read Replicas:** Use read replicas for databases to offload read traffic from the primary write database.
*   **Distributed Caching:** Employ Redis or Memcached for low-latency access to frequently used data (user sessions, popular content metadata).

By combining these architectural patterns and low-level design considerations, a platform can build a robust, scalable infrastructure capable of serving tens of millions of concurrent users for live streaming events.