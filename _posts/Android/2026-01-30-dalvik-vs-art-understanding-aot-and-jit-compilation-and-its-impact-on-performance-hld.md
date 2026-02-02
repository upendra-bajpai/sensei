---
layout: post
title: Dalvik vs ART Understanding AOT and JIT compilation and its impact on performance (HLD)
author: jane
date: 2026-01-30 09:00:00
categories: [ dalvik, HLD, tech-deep-dive ]
image: /assets/images/2026-01-30-dalvik-vs-art-understanding-aot-and-jit-compilation-and-its-impact-on-performance-hld-diagram-1.png
---

The battle for mobile performance isn't fought in the high-level UI code we write; it’s won or lost in the "execution gap"—the space between our high-level instructions and the silicon. In the Android ecosystem, this evolution is defined by two major architectural shifts: Dalvik and the Android Runtime (ART). 

Understanding these runtimes is no longer just "academic" for a Senior Architect. As we push toward more complex applications and cross-platform solutions like React Native (with its own engine, Hermes), we are essentially revisiting the same trade-offs: Memory vs. Battery vs. Disk Space.

## The Strategic Shift: Why the Runtime Changed

The move from Dalvik to ART was driven by a fundamental change in mobile hardware. In the early days of Android, RAM was expensive and storage was scarce. Dalvik was designed for that world. By the time ART arrived in Android 5.0, storage was cheap, but battery life and "smoothness" (minimizing junk frames) became the primary competitive advantages.

This wasn't just a technical upgrade; it was an architectural justification to trade **Disk Space** for **User Experience**. 

### Shared Mental Model: JIT vs. AOT

To understand the impact, we need a clear mental model of the two primary compilation strategies:

1.  **Just-In-Time (JIT):** Compilation happens while the app is running. It identifies "hot code" (frequently executed paths) and compiles those to native code on the fly.
2.  **Ahead-Of-Time (AOT):** Compilation happens before the app ever runs—usually during the installation process. The entire app is transformed into a machine-ready binary (ELF files).

| Feature | Dalvik (JIT) | ART (AOT - Initial) | Modern ART (Hybrid/PGO) |
| :--- | :--- | :--- | :--- |
| **Install Time** | Fast | Very Slow | Balanced |
| **Startup Speed** | Slow (warm-up needed) | Very Fast | Fast |
| **Battery Impact** | Higher (constant compilation) | Lower (pre-compiled) | Optimized |
| **Storage Footprint** | Small | Large (native binaries) | Optimized |
| **Runtime Performance** | Variable | Consistent | Predictive |

## Theoretical Blueprint: The Execution Flow

In both systems, your Kotlin or Java code ends up as **DEX (Dalvik Executable) bytecode**. The difference is in how that DEX becomes machine code.

<img src="/assets/images/2026-01-30-dalvik-vs-art-understanding-aot-and-jit-compilation-and-its-impact-on-performance-hld-diagram-1.png" alt="System Architecture Diagram 1" style="max-width: 100%; height: auto; display: block; margin: 20px auto;" />

In the Dalvik model, the runtime is working hard *while* the user is trying to scroll a list. In the ART model, the device does the heavy lifting while it’s plugged into a charger or during the installation "quiet time."

## Technical Deep Dive: The Evolution of ART

If you’re building for production in 2025, you aren't dealing with pure AOT. Pure AOT proved problematic: users hated 20-minute installation times for large games. Android 7.0 (Nougat) introduced a **Hybrid Model**.

### Prerequisites & Environment
*   **Skill Level:** Senior/Lead Engineer
*   **Runtime:** ART (Android 7.0 through Android 14+)
*   **Key Tool:** `dex2oat`

### The Implementation Journey: Profile-Guided Optimization (PGO)
Modern ART uses a sophisticated three-tier strategy to manage performance without bloating the device storage:

1.  **Initial Run:** The app starts in an interpreted mode. It’s slightly slower, but the installation was instant.
2.  **Profiling:** As the user interacts with the app, ART generates a "Profile" file (JIT-based) identifying exactly which methods are critical for startup and UI smoothness.
3.  **Background Optimization:** When the device is idle and charging, the `dexopt` service runs. It uses the profile to AOT-compile *only* those critical methods into the `.oat` file.

```kotlin
// Context: Understanding how 'hot' code is identified
// A simplified mental model of what the Profiler tracks:
class ProfileTracker {
    private val methodExecutionCount = mutableMapOf<String, Int>()
    private val threshold = 50 

    fun onMethodEntry(methodName: String) {
        val count = methodExecutionCount.getOrDefault(methodName, 0) + 1
        methodExecutionCount[methodName] = count
        
        if (count > threshold) {
            // Mark for AOT compilation in the next background cycle
            markForBackgroundCompilation(methodName)
        }
    }
}
```

## The "Production Gap": PoC vs. Reality

While the theoretical benefits of ART/AOT are clear, production reveals the **80% effort** required to maintain performance.

### 1. The Startup Cold-Start
Even with ART, the first run after an update can be slow. This is because the background optimization hasn't occurred yet. To bridge this, Google introduced **Cloud Profiles**. When one user optimizes an app, the profile is uploaded to Google Play. New users download this "ready-made" profile, allowing the device to AOT-compile the "hot code" before the first launch.

### 2. State Restoration & Process Death
Architecturally, AOT compilation doesn't save you from poor state management. While the code executes faster, a "Cold Start" still requires re-initializing your entire DI (Dependency Injection) graph. 
*   **Architecture Tip:** Use Baseline Profiles to ensure your DI initialization code is pre-compiled.

### 3. Binary Size Bloat
Every byte of AOT-compiled code is a byte of native machine code. If you compile everything, your app size on disk can triple. 
*   **Architectural Guardrail:** Monitor the difference between your `.apk` size and the "App Size on Device" in the Play Console.

## Architectural Anti-patterns & Nightmares

As a Senior Lead, these are the common "red flags" in performance reviews:

### Nightmare 1: Huge Static Initializers
**The Problem:** ART can't optimize what it can't predict. Massive static blocks (`init { ... }` in Kotlin) that perform I/O or heavy computation block the class loader, regardless of whether the code is AOT-compiled.
*   **Senior Tip:** Move static initialization to background tasks or use `Lazy` delegates to keep the class loading path lean.

### Nightmare 2: Over-reliance on Reflection
**The Problem:** Reflection-heavy code (common in older JSON libraries) bypasses many of ART's devirtualization optimizations. AOT-compiled code works best when it knows exactly which method it's calling.
*   **Senior Tip:** Use code generation (KSP/Room/Moshi) instead of runtime reflection. This turns dynamic lookups into static, AOT-optimizable code.

### Nightmare 3: Ignoring Baseline Profiles
**The Problem:** Shipping an app without a `Baseline Profile` is essentially telling ART: "I don't know what's important; figure it out yourself over the next week."
*   **Senior Tip:** Integrate the `androidx.benchmark` library into your CI/CD. Generating a profile should be a required step for every release build.

## Wrap up & The 2026 Roadmap

The runtime is no longer a static box. We are moving toward a world where the boundary between "Build Time" and "Run Time" is blurred. With the rise of **Kotlin Multiplatform (KMP)** and on-device AI integration, the runtime's ability to efficiently manage machine code without draining the battery is our most critical constraint.

In the future, expect ART to become even more modular, potentially receiving updates via Google Play System Updates (Project Mainline) to allow runtime improvements without needing a full OS OTA. As architects, our job is to ensure our code is **AOT-friendly**: static, predictable, and profiled.