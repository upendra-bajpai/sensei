---
layout: post
title: How Disney Hotstar (now JioHotstar) Scaled Its Infra for 60 Million Concurrent Users (HLD)
author: jane
date: 2026-02-15 09:00:00
categories: [ disney, HLD, tech-deep-dive ]
image: /assets/images/2026-02-15-how-disney-hotstar-now-jiohotstar-scaled-its-infra-for-60-million-concurrent-users-hld-diagram-1.png
---

The streaming world is a relentless battleground for user attention. Millions of eyes glued to screens, demanding seamless experiences. Back in 2023, Disney+ Hotstar (now JioHotstar) faced a monumental challenge: supporting an unprecedented 50 to 60 million concurrent live streams. This wasn't just about adding more servers; it was about a fundamental architectural overhaul to handle this sheer scale, especially with a "Free on Mobile" initiative that opened the floodgates.

### The Vision & The Why: Scaling Beyond the Limit

The engineering teams at Hotstar were staring down a beast. Their existing infrastructure, while robust, was maxing out around 25 million concurrent users on two self-managed Kubernetes clusters. Simply throwing more hardware at the problem wasn't a sustainable or cost-effective solution. The vision was clear: build an "X architecture" – a server-driven, flexible, and globally scalable system capable of absorbing massive, unpredictable traffic spikes without faltering.

This wasn't just about keeping pace; it was about staying ahead. The business imperative was to provide a flawless viewing experience, no matter the event or the user count. This meant a significant shift in how they approached infrastructure, networking, and application deployment. It required a move from a reactive scaling model to a proactive, architecturally sound foundation.

### Theoretical Blueprint & Mental Models: The "X Architecture"

At its core, Hotstar's journey was about evolving from a traditional, often siloed, infrastructure setup to a more abstract, adaptable model. Think of it as moving from managing individual rooms in a house to managing a smart, interconnected ecosystem.

Here’s a simplified look at the core components and their roles:

<img src="/assets/images/2026-02-15-how-disney-hotstar-now-jiohotstar-scaled-its-infra-for-60-million-concurrent-users-hld-diagram-1.png" alt="System Architecture Diagram 1" style="max-width: 100%; height: auto; display: block; margin: 20px auto;" />

The key shift was the introduction of **"Data Center Abstraction."** This wasn't about physical data centers, but logical groupings of Kubernetes clusters that acted as a single, cohesive compute unit. This abstraction simplified operations immensely, allowing teams to focus on applications rather than the underlying cluster specifics.

Let's break down the legacy versus the modern approach:

| Feature             | Legacy Way (Pre-2023)                                | Modern Way (Post-2023)                                     | Key Difference                                        |
| :------------------ | :--------------------------------------------------- | :--------------------------------------------------------- | :---------------------------------------------------- |
| **Orchestration**   | Self-managed Kubernetes (KOPS)                       | Amazon EKS (Managed Kubernetes)                            | Offloaded control plane complexity to AWS             |
| **Networking**      | NAT Gateway per AZ, NodePort services                | NAT Gateway per subnet, ClusterIP with ALB Ingress         | Improved network efficiency, eliminated port conflicts |
| **Service Discovery** | Manual configurations, DNS-based                    | Centralized Envoy Gateway, automated service discovery     | Simplified routing, dynamic load balancing            |
| **Deployment**      | Multiple environment-specific manifests               | Single unified manifest template ("One Manifest")          | Reduced duplication, faster, safer deployments        |
| **Infrastructure Mgmt** | Manual ALB management, pre-warming                 | Data Center Abstraction, automated routing & security      | Simplified operations, cluster-agnostic deployments   |
| **Scalability Trigger** | Reactive scaling                                     | Predictive AI scaling, pre-warming                         | Proactive capacity management                         |

### Technical Deep Dive: The Nitty-Gritty of Scaling

The transformation involved tackling several critical layers:

**1. Gateway Optimization: Separating Concerns**

The initial bottleneck was often at the CDN and API Gateway layers. CDNs were doing more than just caching; they were handling security checks and routing. The team identified that not all API requests were equal.

*   **Prerequisites**: Understanding of CDN capabilities, API Gateway patterns, and traffic analysis tools.
*   **Assumptions**: Access to traffic logs and performance metrics.

The breakthrough was **separating cacheable APIs from non-cacheable ones.**

*   **Cacheable APIs**: Data that doesn't change rapidly (e.g., live scores, match summaries). These could be served from a dedicated, lighter CDN domain with simplified security rules.
*   **Non-Cacheable APIs**: Personalized data, session management – these required fresh computation.

This segregation significantly boosted throughput by reducing the load on edge servers and optimizing request processing. They also fine-tuned refresh rates for less critical data and simplified complex CDN rules.

**2. Infrastructure Scaling Layers: Untangling the Network**

*   **Prerequisites**: Deep understanding of AWS networking (VPCs, Subnets, NAT Gateways), Kubernetes networking (Services, NodePort, ClusterIP), and EC2 instance types.
*   **Assumptions**: Familiarity with VPC Flow Logs for traffic analysis.

**NAT Gateway Scaling:**
The initial setup used one NAT Gateway per Availability Zone. This created a significant bottleneck when one cluster generated disproportionately high traffic. The solution? **Migrating to one NAT Gateway per subnet.** This distributed the load more effectively, preventing single points of failure.

**Kubernetes Worker Nodes:**
High-bandwidth services were overloading individual worker nodes. The fix involved:
*   Switching to **high-throughput EC2 instances** capable of handling 10 Gbps+ traffic.
*   Implementing **Kubernetes topology spread constraints** to ensure only one gateway pod ran per node, preventing network contention. This kept throughput balanced at a healthy 2-3 Gbps per node.

**3. EKS Migration: Embracing Managed Services**

*   **Prerequisites**: Experience with Kubernetes, AWS EKS, and cluster management concepts.
*   **Assumptions**: Understanding of Kubernetes control plane vs. data plane.

The move from self-managed KOPS clusters to **Amazon EKS** was crucial. AWS managing the control plane (the brain of Kubernetes) freed up Hotstar’s engineers to focus on the data plane (where applications run).

While EKS offered significant advantages, they encountered **API server throttling** at extreme scales (beyond 400 nodes). The solution was **stepwise scaling**: instead of adding hundreds of nodes at once, they implemented a phased approach (100-300 nodes per step), allowing the control plane to manage the influx gracefully.

**4. "Data Center Abstraction": The Architectural Game Changer**

*   **Prerequisites**: Strong grasp of Kubernetes, microservices, and distributed system design patterns.
*   **Assumptions**: Familiarity with service mesh concepts (like Envoy).

This was the linchpin. By treating multiple EKS clusters within a region as a single logical unit, they:

*   **Simplified Deployments**: Made them cluster-agnostic.
*   **Unified Management**: Enabled centralized routing, security, and observability.
*   **Reduced Overhead**: Allowed teams to focus on applications.

Key innovations within this model included:

*   **Central Envoy Proxy Layer**: Replaced hundreds of individual ALBs with a single, shared fleet of Envoy proxies. This handled routing, authentication, rate limiting, and service discovery for all internal traffic.
*   **Standardized Service Endpoints**: Introduced a consistent naming convention (`<service>.internal.<domain>`) for inter-service communication, simplifying discovery and management.
*   **"One Manifest"**: A single, unified Kubernetes manifest template for all environments, drastically reducing configuration duplication and deployment errors.
*   **Eliminating NodePort**: Migrated from NodePort services to ClusterIP services managed by the AWS ALB Ingress Controller. This removed the port exhaustion issue and streamlined the traffic flow.

### The "Production Gap": From PoC to 60 Million

A Proof of Concept (PoC) is just the beginning. The real work lies in hardening the architecture for production. For Hotstar, this meant addressing:

*   **Scalability**: Implementing adaptive streaming logic to adjust bitrates based on network conditions, ensuring a stable experience even with fluctuating bandwidth. This also involved intelligent client-side behavior like exponential backoff to prevent overwhelming the backend during peak load.
*   **Reliability**: Building multi-level redundancy across clusters and services. If one cluster faced an issue, traffic could seamlessly shift to another. Implementing robust state restoration mechanisms was critical for handling unexpected events like process restarts or node failures.
*   **Edge Cases**:
    *   **Deep Linking**: Ensuring users could jump directly to specific content or live moments, even after multiple redirects or in app updates.
    *   **Configuration Changes**: Managing dynamic configurations across thousands of nodes without service interruption.
    *   **Zero-Downtime Deployments**: Employing blue-green or canary deployment strategies for all microservices.

### Architectural Anti-patterns & "Nightmares"

As Senior Leads, we often see recurring issues in production reviews. Here are a few common "nightmares" related to scaling and navigation, along with how to avoid them:

1.  **"The Monolithic Navigator": Passing `NavController` Down the Tree**
    *   **The Problem**: Injecting the `NavController` deep into UI components creates tight coupling. Changes to navigation structure require widespread code modifications, making refactoring a nightmare and breaking testability.
    *   **Senior Lead Tip**: **Dependency Injection and Navigation Events.** Inject abstractions or use a shared state/event bus for navigation actions. The UI component should *trigger* navigation, not *perform* it directly.

2.  **"Scattered Navigation Logic": Bits of Navigation Everywhere**
    *   **The Problem**: Navigation logic sprinkled across Activities, Fragments, ViewModels, and UI Composables. It's impossible to get a clear picture of the app's flow, leading to bugs and inconsistent behavior.
    *   **Senior Lead Tip**: **Centralized Navigation Manager.** Maintain a single source of truth for navigation state and actions. This could be a dedicated `NavigationManager` class or a state-driven approach managed by a ViewModel.

3.  **"Ignoring State Restoration": The Great Reset on Process Death**
    *   **The Problem**: When an app process is killed by the OS (due to low memory), crucial navigation state (like the current screen or back stack) is lost. Users are unexpectedly returned to the app's entry point.
    *   **Senior Lead Tip**: **Leverage SavedStateHandle and ViewModel.** For Jetpack Compose Navigation, ensure your navigation arguments are `Parcelable` or use `SavedStateHandle` to persist state across process death. ViewModels should be designed to restore their state.

4.  **"Deep Linking Without a Strategy": A Maze of `Intent`s**
    *   **The Problem**: Deep links are implemented in a fragmented way, often with complex conditional logic scattered across Activities/Fragments. Handling complex nested navigation or parameters becomes unmanageable.
    *   **Senior Lead Tip**: **Use a Unified Deep Link Resolver.** Implement a central handler that parses incoming deep links, validates them, and triggers the appropriate navigation action via your centralized manager. Leverage navigation graph features for declarative deep link handling.

### The 2026 Roadmap: Future-Proofing the Architecture

The work Hotstar did was foundational. Looking ahead, the focus shifts to continuous refinement and embracing future technologies:

*   **KMP (Kotlin Multiplatform) Integration**: As more platforms adopt Kotlin, sharing navigation logic between Android, iOS, and potentially desktop clients becomes a significant advantage.
*   **On-Device AI Integration**: For features like personalized recommendations or real-time content analysis, running AI models directly on the device could reduce backend load and improve latency. Navigation needs to seamlessly integrate with these on-device capabilities.
*   **Declarative Navigation Evolution**: Further embracing Jetpack Compose Navigation's declarative nature for even more robust and maintainable UI and navigation logic.

The Hotstar story is a testament to architectural foresight and relentless execution. By moving beyond simple scaling and embracing abstraction, modularity, and managed services, they built an infrastructure that didn't just handle millions of concurrent users—it set a new standard for live streaming reliability.