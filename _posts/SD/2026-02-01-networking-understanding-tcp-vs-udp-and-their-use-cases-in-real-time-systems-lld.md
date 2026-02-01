---
layout: post
title: Networking: Understanding TCP vs UDP and their use cases in real-time systems (LLD)
author: jane
date: 2026-02-01 09:00:00
categories: [ networking:, LLD, system-design ]
image: /assets/images/2026-02-01-networking-understanding-tcp-vs-udp-and-their-use-cases-in-real-time-systems-lld-diagram-1.png
---

### Defining the Communication Requirements

When building a real-time system, such as a multiplayer game or a high-frequency trading platform, we must choose our underlying transport protocol based on the specific needs of the data being sent. Not all data is created equal.

To design an effective network layer, we need to satisfy these technical requirements:
*   **Reliability vs. Speed:** Some messages (like player login or financial transactions) must arrive intact and in order. Others (like player movement or voice data) prioritize low latency over perfect delivery.
*   **Connection Management:** The system must track active sessions for stateful communication (TCP) while allowing "fire-and-forget" broadcasts (UDP).
*   **Congestion Control:** The architecture must prevent the sender from overwhelming the receiver or the network path.
*   **Protocol Agnostic Interface:** The application logic should interact with a unified interface without worrying about whether the underlying transport is TCP or UDP.

---

### Modeling the Network Layer

To achieve a modular design, we separate the protocol implementation from the message handling logic. We use **Composition** to allow a `NetworkClient` to hold a reference to a specific protocol strategy.

| Component | Responsibility | Type |
| :--- | :--- | :--- |
| `ProtocolStrategy` | Interface defining the contract for sending and receiving data. | `Interface` |
| `TCPHandler` | Manages 3-way handshakes, sequencing, and retransmission logic. | `Class` |
| `UDPHandler` | Handles connectionless datagrams with minimal overhead. | `Class` |
| `Packet` | The data envelope containing the payload and metadata. | `Class` |
| `TransmissionMode` | Defines the priority (Reliable, Unreliable, Fast). | `Enum` |

<img src="/assets/images/2026-02-01-networking-understanding-tcp-vs-udp-and-their-use-cases-in-real-time-systems-lld-diagram-1.png" alt="System Architecture Diagram 1" style="max-width: 100%; height: auto; display: block; margin: 20px auto;" />

---

### Implementing Interaction Logic

In real-time systems, we often use the **Strategy Pattern**. This allows us to swap the transport mechanism at runtime based on the message type. For example, a "Chat Message" uses the `TCPHandler`, while "Position Updates" use the `UDPHandler`.

#### Interface Definitions

```java
public interface ProtocolStrategy {
    void connect(String host, int port);
    void transmit(byte[] data);
    void disconnect();
}

public class TCPHandler implements ProtocolStrategy {
    public void transmit(byte[] data) {
        // Implements flow control and acknowledgement
        // Ensures data arrives in the exact order sent
        System.out.println("Sending reliable data via TCP...");
    }
}

public class UDPHandler implements ProtocolStrategy {
    public void transmit(byte[] data) {
        // Implements "fire and forget" logic
        // No overhead for handshaking or ordering
        System.out.println("Sending low-latency data via UDP...");
    }
}
```

#### The Execution Flow

When a high-level action occurs, the `NetworkManager` decides which strategy to invoke.

```mermaid
sequenceDiagram
    participant App as Application Logic
    participant NM as NetworkManager
    participant TCP as TCPHandler
    participant UDP as UDPHandler

    App->>NM: send(chatData, RELIABLE)
    NM->>TCP: transmit(chatData)
    TCP-->>NM: Ack Received
    
    App->>NM: send(positionData, FAST)
    NM->>UDP: transmit(positionData)
    Note over UDP: No Ack required; lower latency
```

---

### Refinement and Edge Cases

A robust LLD must account for the inherent instability of physical networks.

#### 1. Handling Packet Loss in UDP
While UDP doesn't guarantee delivery, we can implement **Application-Level Reliability**. This is common in modern protocols like QUIC. We can add a sequence number to our `Packet` class. If the receiver sees a gap (e.g., received sequence 1, 2, 4), it can optionally request a re-send of 3, or simply discard the outdated data.

#### 2. Head-of-Line (HoL) Blocking
In TCP, if one packet is lost, all subsequent packets are held in the buffer until the lost one is retransmitted. In a real-time system, this "hiccup" can be fatal. To mitigate this, we partition our data:
*   **Critical State:** Sent over TCP.
*   **Transient State:** Sent over UDP. 

#### 3. Concurrency and Thread Safety
The `NetworkManager` should utilize a thread-safe queue for outgoing packets. This prevents the main game/application loop from blocking on I/O operations.

```java
public class NetworkManager {
    private final BlockingQueue<Packet> sendQueue = new LinkedBlockingQueue<>();
    
    public void queueMessage(Packet p) {
        sendQueue.offer(p); // Non-blocking
    }
    
    // Background thread processes the queue using the assigned Strategy
}
```

#### 4. MTU Discovery
Maximum Transmission Unit (MTU) determines the largest packet size allowed. If a UDP packet exceeds the MTU, it may be fragmented by routers, increasing the chance of loss. Our `UDPHandler` should include logic to truncate or split packets to stay under the standard ~1500 byte limit for optimal performance.