---
layout: post
title: Networking: Understanding TCP vs UDP and their use cases in real-time systems (HLD)
author: jane
date: 2026-02-01 09:00:00
categories: [ networking:, HLD, system-design ]
image: /assets/images/2026-02-01-networking-understanding-tcp-vs-udp-and-their-use-cases-in-real-time-systems-hld-diagram-1.png
---

When designing real-time systems, choosing the right transport protocol is one of the most consequential decisions an architect makes. A common mistake is treating networking as a "black box" where packets simply arrive. To understand the trade-offs, let’s start with a typical interview scenario.

### Clarifying the Design Space

**Interviewer:** We need to design a backend for a massive multiplayer online game (MMO) that also supports real-time voice chat. How would you handle the networking?

**Candidate:** That’s an interesting challenge. To narrow down the scope, I have a few questions:
1. What is the scale? Are we talking about 10,000 or 10 million concurrent users?
2. What are the latency requirements for movement versus chat?
3. Does the game state need to be perfectly synchronized, or is "eventual consistency" acceptable for player positions?
4. Do we need to support mobile clients with flaky connections?
5. Is data integrity (making sure every packet arrives) more important than speed for all features?
6. Are we worried about firewall traversal for the voice chat?

**Interviewer:** Good questions. Let’s assume 1 million concurrent users. Movement needs sub-100ms latency. Voice chat can handle some packet loss but needs to be real-time. Important events like "buying an item" must never be lost.

Based on this, we can define our requirements:

**Functional Requirements:**
*   **Low Latency Movement:** Player positions must update near-instantly.
*   **Reliable Transactions:** In-game purchases and login must be guaranteed.
*   **Real-time Audio:** Voice streams must be continuous without "robotic" lag.

**Non-Functional Requirements:**
*   **Scalability:** Support 1M concurrent connections.
*   **Efficiency:** Minimize bandwidth overhead for small, frequent updates.
*   **Availability:** The gateway should handle reconnection gracefully.

**The "Jimmy" Anti-Pattern:**
In many systems, "Jimmy" (our hypothetical junior dev) might decide to use TCP for everything because it’s "reliable." However, in a real-time game, if one TCP packet is lost, the entire stream stops to wait for a retransmission. This is known as **Head-of-Line (HOL) Blocking**. While Jimmy is waiting for that one lost packet from 2 seconds ago, the player has already moved, but the UI stays frozen. We must avoid this.

---

### High-Level Architecture: The Hybrid Approach

For a real-time system of this scale, we don't choose just one protocol. We use a hybrid approach where different data types follow different paths.

**Path of the Request:**
1.  **TCP Path:** Used for "Critical State" (Authentication, Billing, Inventory). This ensures every bit arrives perfectly.
2.  **UDP Path:** Used for "Ephemeral State" (Player coordinates, Voice packets). We care about the *latest* data, not the *oldest* data.

**Core Components:**
*   **Load Balancer (LB):** Distributes incoming TCP and UDP traffic.
*   **Gateway Service:** Acts as the entry point, upgrading connections to WebSockets (TCP) or raw UDP sockets.
*   **Matchmaking/State Service:** Maintains the "Source of Truth" in a fast cache (Redis).
*   **Media/Voice Server:** Specifically optimized for high-throughput UDP streaming.

<img src="/assets/images/2026-02-01-networking-understanding-tcp-vs-udp-and-their-use-cases-in-real-time-systems-hld-diagram-1.png" alt="System Architecture Diagram 1" style="max-width: 100%; height: auto; display: block; margin: 20px auto;" />

---

### Technical Deep Dive

#### 1. Back-of-the-Envelope Estimation
*   **Scale:** 1,000,000 Concurrent Users (CCU).
*   **UDP Traffic:** If a player sends position updates 20 times per second (20Hz), and each packet is ~100 bytes:
    *   $1,000,000 \text{ users} \times 20 \text{ updates/sec} = 20 \text{ million packets/sec}$.
    *   $20,000,000 \times 100 \text{ bytes} \approx 2 \text{ GB/s}$ of aggregate throughput for position alone.
*   **TCP Traffic:** Billing and chat are bursty but low frequency. We might see 5k-10k QPS (Queries Per Second).

#### 2. Deep Dive: Handling Reliability in UDP
Since standard UDP offers no guarantees, how do we prevent players from teleporting all over the place when a packet is lost?
*   **Sequence Numbers:** We attach a simple incrementing ID to every UDP packet. If the client receives packet #10 and then packet #12, it knows #11 is gone. Instead of waiting (like TCP), it simply discards #11 and processes #12 because #12 is more "current."
*   **Client-Side Prediction:** The client "guesses" where the player will be based on velocity. If the UDP packet arrives and contradicts the guess, the client performs a "snap" or "smooth interpolation" to the correct position.

#### 3. Deep Dive: The QUIC Evolution
A modern alternative is **QUIC** (which sits under HTTP/3). QUIC runs over UDP but adds a layer of reliability.
*   **The Problem it Solves:** Traditional TCP requires a 3-way handshake + TLS handshake. This is slow (multiple round trips).
*   **The Innovation:** QUIC combines the handshake and encryption into one step. More importantly, it solves Head-of-Line blocking by allowing multiple "streams" within one connection. If one stream loses a packet, other streams continue unaffected.

#### CAP Theorem Trade-offs
In real-time systems, we lean heavily toward **AP (Availability and Partition Tolerance)**. If a network partition occurs between a player and the server, we prefer the player stays in the game with slightly stale data (Availability) rather than freezing the game for everyone until the state is perfectly synchronized (Consistency).

---

### Potential Bottlenecks and Evolution

As the system grows, we should look out for several "day two" problems:

1.  **UDP Packet Fragmentation:** If our UDP packets exceed the MTU (Maximum Transmission Unit) of ~1500 bytes, routers might fragment them. Fragmented UDP packets are often dropped by firewalls. We must keep our "real-time" payloads small.
2.  **CPU Overhead at the Gateway:** Handling 20M packets/sec requires significant CPU for context switching. We might explore **eBPF** or **DPDK** to process packets directly in the kernel or bypass the kernel entirely for the UDP path.
3.  **Security (DTLS):** Plain UDP is vulnerable to spoofing. Implementing Datagram Transport Layer Security (DTLS) adds encryption but increases the packet header size, which we must account for in our bandwidth budget.
4.  **Jitter Buffering:** For the voice component, network "jitter" (varying delay) is more annoying than constant latency. We need a jitter buffer on the client-side to collect UDP packets and play them back at a steady rate.

By splitting our architecture into a reliable TCP control plane and a fast UDP data plane, we achieve the best of both worlds: rock-solid consistency for transactions and "twitch-response" speed for gameplay.