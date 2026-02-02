---
layout: post
title: Mastering Jetpack Compose Side-Effects: When to use LaunchedEffect vs DisposableEffect vs SideEffect (LLD)
author: jane
date: 2026-01-30 09:00:00
categories: [ mastering, LLD, system-design ]
image: /assets/images/2026-01-30-mastering-jetpack-compose-side-effects-when-to-use-launchedeffect-vs-disposableeffect-vs-sideeffect-lld-diagram-1.png
---

In a declarative UI framework like Jetpack Compose, the primary function of a composable is to transform data into a UI tree. However, real-world applications require operations that happen "on the side"—fetching data from a network, subscribing to a sensor, or updating a legacy database. 

The challenge lies in the nature of recomposition. Since composable functions can execute at any time, in any order, and can even be cancelled, executing a side effect directly in the body of a function leads to unpredictable behavior, memory leaks, and race conditions. To solve this, we must design a controlled environment that bridges the gap between the stateless UI and the stateful world outside.

### Defining the Problem Space

To design a robust side-effect strategy, we first need to categorize the specific technical requirements of the work we intend to perform:

*   **Asynchronous Execution:** Does the task need to run in a coroutine (e.g., API calls, animations)?
*   **Resource Management:** Does the task require a manual cleanup phase (e.g., unregistering a BroadcastReceiver)?
*   **External Synchronization:** Does the task simply need to notify a non-Compose system that a successful recomposition occurred?
*   **Restart Logic:** Under what conditions should the task be cancelled and restarted?

| Feature | LaunchedEffect | DisposableEffect | SideEffect |
| :--- | :--- | :--- | :--- |
| **Execution Context** | Coroutine Scope | Synchronous Block | Synchronous Block |
| **Cleanup Mechanism** | Automatic (via Job cancellation) | Manual (via `onDispose`) | None |
| **Frequency** | On Key Change | On Key Change | After Every Recomposition |
| **Use Case** | Network, Timers, Animations | Observers, Listeners | Analytics, Manual Loggers |

### Identifying Core Architectural Objects

When designing components that manage side effects, we treat the effects as "Lifecycle-Aware Workers." These are managed by the Compose Runtime, acting as an orchestrator.

| Object | Role | Relationship |
| :--- | :--- | :--- |
| **Composition** | The active tree of UI components. | Owns the lifecycle of the effect. |
| **Effect Key** | A trigger for re-evaluation. | Composition uses this to determine idempotency. |
| **CoroutineScope** | The execution environment for `LaunchedEffect`. | Cancelled when the composable leaves the UI tree. |
| **DisposeAction** | A cleanup contract for `DisposableEffect`. | Inherited by the effect's internal state. |

### Designing the Interaction Logic

Imagine we are building a video player component. This component must:
1. Start a timer to track watch time (`LaunchedEffect`).
2. Register a sensor listener to detect orientation changes (`DisposableEffect`).
3. Notify an analytics engine of the current volume level (`SideEffect`).

We can model this interaction using the **Strategy Pattern**. Based on the "strategy" of the lifecycle required, we select the appropriate effect.

#### The Lifecycle Sequence
When a user navigates to the Video Player, the following sequence occurs:

<img src="/assets/images/2026-01-30-mastering-jetpack-compose-side-effects-when-to-use-launchedeffect-vs-disposableeffect-vs-sideeffect-lld-diagram-1.png" alt="System Architecture Diagram 1" style="max-width: 100%; height: auto; display: block; margin: 20px auto;" />

#### Implementation Pattern: The "Restartable Effect"
A common pitfall is hardcoding keys. To follow SOLID principles, specifically the Open/Closed Principle, we design effects to be reactive to their inputs.

```kotlin
@Composable
fun VideoPlayer(videoId: String, analytics: Analytics) {
    // Strategy 1: LaunchedEffect for scoped async work
    // Restart logic: If videoId changes, cancel previous timer and start new.
    LaunchedEffect(videoId) {
        val timer = WatchTimer()
        timer.start()
        // Coroutine is automatically cleaned up on leave
    }

    // Strategy 2: DisposableEffect for resource management
    val context = LocalContext.current
    DisposableEffect(context) {
        val receiver = OrientationReceiver()
        context.registerReceiver(receiver)
        
        onDispose {
            context.unregisterReceiver(receiver)
        }
    }

    // Strategy 3: SideEffect for external sync
    // Ensures analytics only sees 'finished' states of recomposition
    SideEffect {
        analytics.log("UIRendered", mapOf("id" to videoId))
    }
}
```

### Refinement and Handling Edge Cases

As a system architect, we must account for scenarios where the UI is highly volatile or the network is unstable.

#### 1. The "Million Lambdas" Problem (rememberUpdatedState)
If a side effect uses a parameter that changes frequently (like a scroll position) but the effect itself shouldn't restart, the system can become jittery. We solve this using `rememberUpdatedState`. This ensures the effect always points to the latest value without triggering a costly restart of the coroutine.

#### 2. Concurrency and Idempotency
Side effects should ideally be idempotent. If an effect triggers a payment, we must ensure that a recomposition doesn't trigger a duplicate transaction. 
*   **Design Rule:** Move business-critical logic (like payments) out of the UI Effects and into the ViewModel or a specialized Domain Layer. The UI Effect should only trigger a "UI Event" (like showing a Snackbar or navigating).

#### 3. Testing and AppNotIdleException
In automated testing (e.g., Espresso or Compose UI Test), long-running `LaunchedEffects` can prevent the test from reaching an "Idle" state, causing timeouts.
*   **Refinement:** Design components to accept a `CoroutineDispatcher` as a dependency. In production, use `Dispatchers.Main`; in tests, use `StandardTestDispatcher` to gain manual control over time.

By treating side effects as structured lifecycle participants rather than "escape hatches," we maintain the predictability of the unidirectional data flow while allowing the application to interact safely with the stateful world.