---
layout: post
title: Custom ClassLoaders in Android: How Plugin-based architectures and Hot-Fixing work (HLD)
author: jane
date: 2026-01-29 09:00:00
categories: [ custom, HLD, tech-deep-dive ]
image: /assets/images/2026-01-29-custom-classloaders-in-android-how-plugin-based-architectures-and-hot-fixing-work-hld-diagram-1.png
---

Okay, let's dive into the world of Android navigation, specifically focusing on how Jetpack Navigation Component's evolution, particularly with Navigation Compose 3, is reshaping our approach.

## The Vision: From Imperative UI to State-Driven Navigation

As we look at modern Android development, there's a clear trend towards declarative UI and robust state management. This isn't just about chasing the latest hype; it's about architecting for the long haul. Consider the business implications: reducing maintenance costs, improving developer velocity, and ultimately, delivering a more stable and scalable user experience.

The older way of handling navigation, often tied to Fragments and imperative calls, meant a lot of scattered logic. We'd pass `NavController` down the hierarchy, leading to tight coupling and making testing a chore. The shift we're seeing with Jetpack Compose Navigation, especially with version 3, is a move towards a **state-driven paradigm**. Instead of telling the UI *how* to navigate, we declare *what* the navigation state *should be*, and the UI reacts accordingly. This aligns perfectly with the declarative nature of Compose itself.

### Technology Adoption: Hype vs. Justification

It's easy to get swept up in the excitement of new technologies. But as architects, our job is to cut through the noise. Is a new navigation library just a shiny new toy, or does it fundamentally solve existing problems and unlock future capabilities?

Jetpack Compose Navigation, particularly its latest iterations, offers a compelling architectural justification. It addresses the inherent complexities of managing navigation state in a reactive UI framework. This isn't just an incremental update; it's a foundational shift that promises better maintainability, testability, and a more predictable application architecture.

## The Blueprint: A State-Driven Mental Model

To truly leverage modern navigation patterns, we need a shared mental model. Think of it as a contract between your navigation logic and your UI.

| Feature           | Legacy Way (Fragments/NavController)                                   | Modern Way (Compose Navigation 3 / State-Driven)                               |
| :---------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| **Paradigm**      | Imperative: Call methods to navigate.                                 | Declarative: Define the desired navigation state.                            |
| **Logic Location**| Often scattered across Activities, Fragments, and ViewModels.         | Centralized in a dedicated state manager (ViewModel, dedicated class).       |
| **Coupling**      | High coupling between UI components and navigation logic.             | Decoupled; UI observes navigation state changes.                             |
| **Testability**   | Difficult to unit test navigation flows in isolation.                 | Highly testable; navigation logic can be tested independently of the UI.     |
| **State Mgmt.**   | Manual state management, often complex for deep links and back stack. | Leverages Compose's state management for seamless updates and restoration.   |
| **Deep Linking**  | Requires explicit handling within Activities/Fragments.               | Integrated seamlessly via URI parsing and state updates.                     |

### The Navigation State Flow

To visualize this, imagine our navigation logic as the source of truth for the application's current screen.

<img src="/assets/images/2026-01-29-custom-classloaders-in-android-how-plugin-based-architectures-and-hot-fixing-work-hld-diagram-1.png" alt="System Architecture Diagram 1" style="max-width: 100%; height: auto; display: block; margin: 20px auto;" />

In this flow, the `Navigation Manager` (our single source of truth) dictates the `Navigation State`. The `Compose UI` simply observes this state and renders the appropriate screen. It's a one-way data flow, making it predictable and easier to reason about.

## The Implementation Journey: Building the Single Source of Truth

Let's get hands-on. The core idea is to extract navigation logic out of the UI and into a centralized, observable state manager. This typically lives within a `ViewModel` or a dedicated class that can be observed by your composables.

### Prerequisites & Assumptions

*   **Android Studio Giraffe or later**: For optimal Compose and Navigation Compose 3 support.
*   **Jetpack Compose Navigation**: `androidx.navigation:navigation-compose:2.7.0` or higher.
*   **Kotlin Coroutines & Flow**: Familiarity with `StateFlow` or `SharedFlow` for observable state.
*   **Basic understanding of ViewModels**: For managing UI-related state.

### Designing the State Machine

We'll create a `NavigationManager` that holds our current navigation state.

**`NavigationManager.kt`** (in your `common` or `shared` module, or a dedicated `navigation` module):

```kotlin
import androidx.compose.runtime.Stable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * Represents the current destination in our navigation graph.
 * This sealed class defines all possible screens.
 */
sealed interface AppDestination {
    data object Home : AppDestination
    data class Profile(val userId: String) : AppDestination
    data object Settings : AppDestination
    // Add other destinations here...
}

/**
 * Manages the application's navigation state.
 * This class acts as the single source of truth for navigation.
 */
@Stable // Important for Compose recomposition performance
class NavigationManager {

    private val _currentDestination = MutableStateFlow<AppDestination>(AppDestination.Home)
    val currentDestination: StateFlow<AppDestination> = _currentDestination.asStateFlow()

    /**
     * Navigates to a new destination.
     * @param destination The target destination.
     */
    fun navigateTo(destination: AppDestination) {
        _currentDestination.update { destination }
        // In a real app, you might also handle back stack logic here,
        // or trigger navigation events via a Channel for one-time actions.
    }

    /**
     * Handles returning to the previous destination.
     * This is a simplified example; a real implementation might use a back stack.
     */
    fun goBack() {
        // For simplicity, we'll just reset to Home.
        // A robust solution would manage a back stack.
        _currentDestination.value = AppDestination.Home
    }

    // ... other navigation-related functions like deep link handling ...
}
```

**Key Takeaways:**

*   **`AppDestination` Sealed Class**: This is crucial. It defines *all* possible states (screens) your application can be in. Using a sealed class ensures exhaustiveness, meaning you'll be prompted to handle all cases when switching states.
*   **`@Stable` Annotation**: For performance in Compose. It signals that the object's identity is stable and doesn't need to be checked deeply during recomposition.
*   **`StateFlow`**: This is our observable stream of navigation states. Any composable observing `currentDestination` will automatically recompose when the state changes.
*   **Single Source of Truth**: All navigation commands (like `navigateTo` and `goBack`) are funneled through this manager.

### Integrating with ViewModel

Now, let's make this `NavigationManager` accessible to our composables via a `ViewModel`.

**`MainViewModel.kt`** (in your `ui` or `presentation` module):

```kotlin
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class MainViewModel(
    private val navigationManager: NavigationManager // Injected via DI
) : ViewModel() {

    val currentDestination: StateFlow<AppDestination> = navigationManager.currentDestination

    fun navigateToProfile(userId: String) {
        navigationManager.navigateTo(AppDestination.Profile(userId))
    }

    fun navigateToSettings() {
        navigationManager.navigateTo(AppDestination.Settings)
    }

    fun goBack() {
        navigationManager.goBack()
    }

    // If using Channels for one-time events (like Snackbar messages or navigation actions)
    // private val _navigationEvents = Channel<NavigationEvent>()
    // val navigationEvents = _navigationEvents.receiveAsFlow()
}

// Example of a one-time event for navigation actions that shouldn't be replayed
// sealed interface NavigationEvent {
//     data class NavigateTo(val destination: AppDestination) : NavigationEvent
//     object GoBack : NavigationEvent
// }
```

**Key Takeaways:**

*   **Dependency Injection**: The `NavigationManager` is injected, promoting loose coupling.
*   **ViewModel as Facade**: The `ViewModel` exposes the navigation state and actions, abstracting the `NavigationManager` from the UI layer.
*   **`viewModelScope`**: Used for any coroutine work initiated by the ViewModel (e.g., handling deep links asynchronously).

### Composable UI Layer

Finally, let's see how our composables consume this state.

**`MainActivity.kt`** (or your main `AppNavigation` composable):

```kotlin
import androidx.compose.runtime.*
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.launch

@Composable
fun AppNavigation(viewModel: MainViewModel = viewModel()) { // Inject ViewModel

    // Observe the navigation state from the ViewModel
    val currentDestination by viewModel.currentDestination.collectAsState()

    // We still need a NavHost controller for Compose Navigation's internal mechanics
    // but our logic dictates what it navigates to.
    val navController = rememberNavController()

    // Effect to react to changes in the AppDestination state
    LaunchedEffect(currentDestination) {
        when (val destination = currentDestination) {
            AppDestination.Home -> navController.navigate(AppDestination.Home.route) {
                // Configure popUpTo, launchSingleTop for smoother navigation
                popUpTo(navController.graph.id) { inclusive = true }
                launchSingleTop = true
            }
            is AppDestination.Profile -> navController.navigate(destination.route) {
                popUpTo(navController.graph.id) { inclusive = true }
                launchSingleTop = true
            }
            AppDestination.Settings -> navController.navigate(AppDestination.Settings.route) {
                popUpTo(navController.graph.id) { inclusive = true }
                launchSingleTop = true
            }
            // Handle other destinations...
        }
    }

    NavHost(
        navController = navController,
        startDestination = AppDestination.Home.route // Initial destination
    ) {
        composable(AppDestination.Home.route) { HomeScreen() }
        composable(AppDestination.Profile.route) { backStackEntry ->
            val userId = backStackEntry.arguments?.getString("userId") ?: "unknown"
            ProfileScreen(userId = userId)
        }
        composable(AppDestination.Settings.route) { SettingsScreen() }
        // Define other composable destinations here...
    }
}

// Extension properties for routes to keep them clean
val AppDestination.route: String
    get() = when (this) {
        AppDestination.Home -> "home"
        is AppDestination.Profile -> "profile/{userId}"
        AppDestination.Settings -> "settings"
    }

// Example composable screens (implementations omitted for brevity)
@Composable
fun HomeScreen() { /* ... */ }

@Composable
fun ProfileScreen(userId: String) { /* ... */ }

@Composable
fun SettingsScreen() { /* ... */ }
```

**Key Takeaways:**

*   **`collectAsState()`**: This is how composables subscribe to `StateFlow`. When `currentDestination` changes, the `AppNavigation` composable recomposes.
*   **`LaunchedEffect`**: This is where the magic happens. When `currentDestination` changes, this effect triggers navigation within the Compose `NavController`. We're essentially translating our declarative `AppDestination` state into imperative calls for the `NavController`.
*   **`NavHost` Configuration**: The `NavHost` is still used, but its `startDestination` and navigation logic are driven by our `NavigationManager` via the `ViewModel`.
*   **Routes as Extension Properties**: Keeping route definitions clean and associated with their `AppDestination` counterparts.

## The Production Gap: Beyond the PoC

Building a PoC is one thing; making it production-ready is another. This is where the real engineering effort lies.

### Non-Functional Requirements (NFRs)

*   **Scalability**:
    *   **Multi-pane/Adaptive Layouts**: How does your navigation adapt to different screen sizes (phones, tablets, foldables)? Your `NavigationManager` should be able to provide state that informs the UI how to render (e.g., showing a master-detail view).
    *   **Modularization**: As your app grows, navigation logic should be organized into modules (e.g., feature modules). Your `NavigationManager` needs to be designed to integrate with these modular navigation graphs.
*   **Reliability**:
    *   **State Restoration Across Process Death**: This is critical. When Android kills your app process, the `ViewModel` is recreated. Your `NavigationManager` needs to persist its state (e.g., using `SavedStateHandle` in the `ViewModel`) so that navigation can resume correctly. The `currentDestination` should be saved and restored.
    *   **Deep Link Resolution**: Robust handling of incoming deep links. This often involves parsing the URI, translating it into an `AppDestination`, and navigating accordingly. This logic should live within your `NavigationManager` or be triggered by it.
*   **Edge Cases**:
    *   **Configuration Changes**: While Compose handles recomposition well, ensure your navigation state is correctly preserved across orientation changes or other configuration changes.
    *   **Complex Back Stack Management**: For intricate flows, a simple `StateFlow` for the current destination might not be enough. You might need to manage a more sophisticated back stack, potentially using a `MutableList<AppDestination>` or a dedicated back stack library.

## Architectural Anti-Patterns & Nightmares

As leads, we see these repeatedly in code reviews. They're the quick fixes that become technical debt.

1.  **"Passing NavController Down the Tree"**:
    *   **Nightmare**: `Activity` passes `NavController` to `ViewModel`, `ViewModel` passes to `Composable`, `Composable` passes to its children. This creates an unbreakable chain, making testing and refactoring a nightmare.
    *   **Senior Lead Tip**: **Centralize Navigation Commands**. Use the `NavigationManager` as the sole entry point for navigation actions. The UI *observes* the state; it doesn't *drive* navigation directly by holding a `NavController`.

2.  **"Scattered Navigation Logic"**:
    *   **Nightmare**: Navigation decisions are made in `onClick` listeners, `ViewModel` functions, and even within `LaunchedEffect` blocks across various screens. It's impossible to trace a navigation flow.
    *   **Senior Lead Tip**: **Define All Destinations in a Single `AppDestination` Sealed Class**. Treat your navigation graph as a finite state machine. All possible destinations and their parameters should be explicitly defined here.

3.  **"Ignoring State Restoration"**:
    *   **Nightmare**: App crashes or behaves unexpectedly after a process death because the navigation state isn't restored. Users lose their place.
    *   **Senior Lead Tip**: **Leverage `SavedStateHandle` in ViewModels**. Ensure your `NavigationManager` state is saved and restored, especially the current destination and any parameters associated with it.

4.  **"Treating Navigation as Side Effects Only"**:
    *   **Nightmare**: Using `LaunchedEffect` for *all* navigation, even when a simple state update would suffice. This can lead to unnecessary recompositions and complex dependency chains.
    *   **Senior Lead Tip**: **Distinguish State vs. Events**. Use `StateFlow` for persistent navigation states (what screen are we on?) and `Channel`s for one-time navigation events (e.g., "show Snackbar," "navigate to a temporary screen").

## The 2026 Roadmap: Future-Proofing Navigation

The landscape of Android development is always evolving. When architecting now, we should consider what's coming next.

*   **Kotlin Multiplatform (KMP) Support**: As KMP gains traction, our navigation logic should ideally be shareable across platforms (Android, iOS, Desktop). A state-driven approach using `StateFlow` and a `NavigationManager` is inherently more portable than Fragment-based logic.
*   **On-Device AI Integration**: Imagine AI models suggesting next steps or dynamically altering navigation paths based on user context. A centralized, observable navigation state is the perfect place to integrate such intelligence.
*   **Multi-Platform Logic Sharing**: Beyond just KMP, think about how your navigation logic can be more easily consumed by different UI frameworks or even backend services if needed. A well-defined state model facilitates this.

By embracing state-driven navigation today, we're building systems that are not only more robust and maintainable for current needs but are also primed for the architectural shifts of tomorrow. It's about building for resilience and adaptability.