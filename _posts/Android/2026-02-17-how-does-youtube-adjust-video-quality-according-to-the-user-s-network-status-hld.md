---
layout: post
title: How does YouTube adjust video quality according to the user’s network status (HLD)
author: jane
date: 2026-02-15 09:00:00
categories: [ does, HLD, tech-deep-dive ]
image: assets/images/4.jpg
---

The constant evolution of mobile development platforms presents a fascinating challenge for us as architects and technical leaders. We're not just building features; we're shaping the maintainability, scalability, and long-term viability of our products. Today, we're diving deep into a shift that's fundamentally changing how we approach Android UI development: the move towards state-driven navigation, specifically with the advent of Navigation Compose 3 (Nav3).

### The Vision & The Why

Why this architectural pivot now? It’s not about chasing the latest hype. It's about aligning our technical strategy with tangible business benefits. The current landscape, dominated by Fragment-based navigation or earlier Compose Navigation patterns, while functional, often leads to fragmented state management and an imperative style of UI control that becomes unwieldy as applications grow.

**Technology Adoption: Hype vs. Justification**

The initial excitement around Jetpack Compose was palpable, and rightfully so. But early navigation solutions, while offering a glimpse into declarative UI, often retained vestiges of the imperative Fragment world. Nav3 represents a maturation – a move towards a truly state-driven, declarative paradigm for navigation. This isn't just a new API; it's a shift in our **shared mental model**. We need to transition from thinking about *how* to navigate (e.g., `NavController.navigate(...)`) to *what* the desired destination state is. This aligns directly with Compose's core philosophy and unlocks significant advantages in maintainability, testability, and developer experience.

### Theoretical Blueprint & Mental Models

To understand Nav3, let's contrast it with its predecessors.

| Feature             | Legacy Way (Fragments/Nav2)                                | Modern Way (Nav3/State-Driven)                                   |
| :------------------ | :--------------------------------------------------------- | :--------------------------------------------------------------- |
| **UI Paradigm**     | Imperative (Directly call navigation methods)              | Declarative (Define navigation state, UI reacts)                 |
| **State Management**| Scattered, often tied to LifecycleOwners, manual updates   | Centralized, observable `StateFlow` or `SharedFlow`            |
| **Navigation Trigger**| `NavController.navigate()` calls from various components   | UI state changes, observed by a central navigation controller  |
| **Testability**     | Difficult to isolate navigation logic, requires Robolectric | Navigation logic can be tested in isolation, decoupled from UI |
| **Recomposition**   | Can lead to unnecessary recompositions, complex state sync | Optimized recompositions based on navigation state changes       |
| **Deep Linking**    | Often involves manual `NavController` manipulation         | Integrated natively with navigation state and routing            |

The core of this shift lies in treating navigation as a form of UI state. Instead of commanding the navigation controller to perform an action, we update a state variable, and the UI, driven by this state, navigates accordingly.

Here’s a conceptual look at the state flow:

```mermaid
graph TD
    A[User Action/Event] --> B{Update Navigation State};
    B --> C[Navigation State Holder (e.g., ViewModel)];
    C --> D[Navigation State (e.g., StateFlow<Route>)];
    D --> E[Compose UI];
    E --> F[Observe Navigation State];
    F --> G[Display Correct Screen];
    G --> A;
```

This diagram illustrates a simplified flow: a user action triggers a state update in a central holder. This holder emits the new navigation state, which the UI observes, leading to the display of the appropriate screen. This reactive approach is the foundation of Nav3.

### Technical Deep Dive: The Implementation Journey

Before we dive into the code, let's set the stage.

**Prerequisites & Assumptions:**

*   **Kotlin Expertise:** Strong understanding of Kotlin coroutines, `StateFlow`/`SharedFlow`, and functional programming concepts.
*   **Jetpack Compose Proficiency:** Familiarity with composable functions, state management (`remember`, `mutableStateOf`), and basic navigation concepts with Navigation Compose 2.x.
*   **Architecture Components:** You should be comfortable with ViewModels and dependency injection (e.g., Hilt).
*   **Environment:** Targeting Android API level 24+ and Jetpack Compose BOM version `2023.08.00` or later for Navigation Compose 3.0.

**The Single Source of Truth: The Navigation Manager**

The cornerstone of a robust Nav3 implementation is a centralized `NavigationManager` or `Navigator` class. This class will own the navigation state and expose it as an observable flow. All navigation events should be channeled through this manager.

Let’s consider a basic setup:

**File: `core/navigation/Route.kt`**

```kotlin
// Represents a destination in our app.
// Sealed class allows for exhaustive checks and type safety.
sealed class Route(val path: String) {
    data object Home : Route("home")
    data class Detail(val itemId: String) : Route("detail/{itemId}") {
        fun createPath(itemId: String): String = "detail/$itemId"
    }
    data object Settings : Route("settings")
}
```

**File: `core/navigation/NavigationManager.kt`**

```kotlin
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

// A central place to manage navigation events and state.
class NavigationManager {

    private val _currentNavigationState = MutableStateFlow<Route>(Route.Home)
    val currentNavigationState: StateFlow<Route> = _currentNavigationState.asStateFlow()

    // Function to trigger navigation. This is the single entry point.
    fun navigateTo(destination: Route) {
        _currentNavigationState.update { destination }
    }

    // Optional: Function to handle back navigation, if needed explicitly.
    // In many Compose Nav scenarios, back is implicitly handled by state updates.
    fun goBack() {
        // Logic for back navigation, perhaps emitting a specific event or
        // relying on the NavController's built-in back stack.
        // For simplicity here, we'll rely on the NavController's built-in behavior.
    }

    // Helper to construct the NavHost. This is a key part of integrating
    // the state flow with the actual navigation component.
    @Composable
    fun NavHostComponent(startDestination: Route = Route.Home) {
        val navController = rememberNavController()
        // Observe the navigation state and trigger navigation events.
        // This `LaunchedEffect` is crucial for reacting to state changes.
        LaunchedEffect(Unit) {
            currentNavigationState.collect { route ->
                navController.navigate(route.path) {
                    // Optional: Configure popUpTo, launchSingleTop, restoreState etc.
                    // This is where you'd define your navigation strategy.
                    popUpTo(navController.graph.startDestinationId) {
                        saveState = true
                    }
                    launchSingleTop = true
                    restoreState = true
                }
            }
        }

        NavHost(
            navController = navController,
            startDestination = startDestination.path
        ) {
            composable(Route.Home.path) { HomeScreen(onNavigate = { route -> navigateTo(route) }) }
            composable(
                route = Route.Detail.path,
                arguments = listOf(navArgument("itemId") { type = NavType.StringType })
            ) { backStackEntry ->
                val itemId = backStackEntry.arguments?.getString("itemId") ?: ""
                DetailScreen(itemId = itemId, onNavigate = { route -> navigateTo(route) })
            }
            composable(Route.Settings.path) { SettingsScreen(onNavigate = { route -> navigateTo(route) }) }
        }
    }
}
```

**File: `ui/screens/HomeScreen.kt`**

```kotlin
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview

@Composable
fun HomeScreen(onNavigate: (Route) -> Unit) {
    Column {
        Text("Welcome to Home!")
        Button(onClick = { onNavigate(Route.Detail.createPath("123")) }) { // Example navigation with argument
            Text("Go to Detail")
        }
        Button(onClick = { onNavigate(Route.Settings) }) {
            Text("Go to Settings")
        }
    }
}

@Preview(showBackground = true)
@Composable
fun HomeScreenPreview() {
    HomeScreen(onNavigate = {})
}
```

**File: `ui/screens/DetailScreen.kt`**

```kotlin
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview

@Composable
fun DetailScreen(itemId: String, onNavigate: (Route) -> Unit) {
    Column {
        Text("Detail Screen for Item: $itemId")
        Button(onClick = { onNavigate(Route.Home) }) {
            Text("Go Back Home")
        }
    }
}

@Preview(showBackground = true)
@Composable
fun DetailScreenPreview() {
    DetailScreen(itemId = "previewItemId", onNavigate = {})
}
```

**File: `ui/screens/SettingsScreen.kt`**

```kotlin
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview

@Composable
fun SettingsScreen(onNavigate: (Route) -> Unit) {
    Column {
        Text("Settings")
        Button(onClick = { onNavigate(Route.Home) }) {
            Text("Go Back Home")
        }
    }
}

@Preview(showBackground = true)
@Composable
fun SettingsScreenPreview() {
    SettingsScreen(onNavigate = {})
}
```

**File: `MainActivity.kt` (or your main activity/app entry point)**

```kotlin
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.lifecycle.viewmodel.compose.viewModel // Import for ViewModel
import com.your_app_package.core.navigation.NavigationManager // Adjust import path
import com.your_app_package.ui.screens.HomeScreen // Adjust import path
import com.your_app_package.ui.screens.DetailScreen // Adjust import path
import com.your_app_package.ui.screens.SettingsScreen // Adjust import path

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            // Provide the NavigationManager instance, typically via ViewModel or DI
            val navigationManager = remember { NavigationManager() } // Simplified for demo, use DI in production
            AppNavigation(navigationManager = navigationManager)
        }
    }
}

@Composable
fun AppNavigation(navigationManager: NavigationManager) {
    MaterialTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            // Pass the navigation manager to the NavHostComponent
            navigationManager.NavHostComponent()
        }
    }
}

// Preview for MainActivity (optional)
@Preview(showBackground = true)
@Composable
fun DefaultPreview() {
    val navigationManager = remember { NavigationManager() } // Simplified for demo
    AppNavigation(navigationManager = navigationManager)
}
```

The key here is that the `NavigationManager` exposes `currentNavigationState` as a `StateFlow`. The `NavHostComponent` observes this flow and, using `LaunchedEffect`, triggers the `navController.navigate()` calls. This decouples the navigation *logic* from the UI composition itself.

### The "Production Gap": PoC vs. Reality

A successful Proof of Concept (PoC) is rarely the end of the journey. It’s the 20% that unlocks the remaining 80% of the real engineering effort. When we move from a simple demo to production, we must consider Non-Functional Requirements (NFRs).

**Scalability: Multi-pane & Adaptive Layouts**

A core advantage of state-driven navigation is its inherent flexibility. Nav3 allows us to easily adapt the UI based on screen size or device type. Instead of having separate `NavGraph`s for different layouts, we can have a single `NavHost` and conditionally display content:

```kotlin
// In your main screen composable where NavHostComponent is called:
val navigationManager = remember { NavigationManager() } // Assume injected
val currentDestination by navigationManager.currentNavigationState.collectAsState()

val isTablet = isSystemInMultiWindowMode() || /* check screen width */

if (isTablet) {
    Row(modifier = Modifier.fillMaxSize()) {
        // Side Navigation Rail (e.g., for Home, Settings)
        NavigationRail {
            // Navigation items for top-level destinations
            NavigationRailItem(
                selected = currentDestination is Route.Home,
                onClick = { navigationManager.navigateTo(Route.Home) },
                icon = { Icon(Icons.Default.Home, contentDescription = "Home") }
            )
            // ... other items
        }
        // Main content area
        Box(modifier = Modifier.weight(1f)) {
            navigationManager.NavHostComponent(
                startDestination = Route.Home, // Start on Home
                navController = rememberNavController() // Or pass navController from parent
            ) { navGraphBuilder ->
                // Define your navigation graph here, conditionally showing screens
                navGraphBuilder.composable(Route.Home.path) {
                    HomeScreen(onNavigate = navigationManager::navigateTo)
                }
                // For detail screens, you might show them in the main pane
                navGraphBuilder.composable(Route.Detail.path, ...) { backStackEntry ->
                    val itemId = ...
                    // If it's a tablet, show a detail pane
                    if (isTablet) {
                        DetailScreen(itemId = itemId, onNavigate = navigationManager::navigateTo)
                    } else {
                        // If not a tablet, navigate to a new screen
                        // (This logic would typically be handled by the onNavigate lambda)
                    }
                }
            }
        }
    }
} else {
    // Single-pane layout for phones
    navigationManager.NavHostComponent(startDestination = Route.Home)
}
```

**Reliability: State Restoration**

A critical aspect of modern Android development is handling process death and configuration changes gracefully. With a centralized `StateFlow` for navigation, state restoration becomes significantly simpler. The `NavHostController` itself supports state saving and restoration. By configuring `popUpTo` with `saveState = true` and `restoreState = true` in `LaunchedEffect`, we leverage the Compose Navigation library's built-in capabilities.

**Edge Cases:**

*   **Deep Linking:** Nav3 integrates with deep links by allowing them to be treated as `Route` objects. The `navController.handleDeepLink(intent)` call can be integrated with your `NavigationManager` to update the navigation state based on incoming intents.
*   **Configuration Changes:** Since the `NavigationManager` (likely hosted in a ViewModel) survives configuration changes, the navigation state is preserved automatically. The `LaunchedEffect` will recompose and re-collect the `StateFlow`, ensuring the UI reflects the correct destination.
*   **Multiple Back Stacks:** For more complex flows (like tabs), you might need multiple `NavController`s. Nav3’s state-driven approach can manage these by having separate `StateFlow`s for each navigation graph or by incorporating a stack management logic within the `NavigationManager`.

### Architectural Anti-patterns & "Nightmares"

As senior leads, we see recurring patterns that, while functional in small projects, become technical debt nightmares in production.

1.  **Passing `NavController` Down the Composition Tree:**
    *   **The Nightmare:** Composable functions accepting `NavController` as a parameter. This tightly couples UI elements to the navigation implementation, making them hard to test and reuse.
    *   **Senior Lead Tip:** Always hoist navigation actions. Composables should only emit events (e.g., `onNavigateToDetail(itemId)`). A higher-level composable (like the one containing the `NavHostComponent`) observes these events and calls `navigationManager.navigateTo()`.

2.  **Scattered Navigation Logic:**
    *   **The Nightmare:** Navigation triggers (`navController.navigate()`) scattered across ViewModels, Repositories, or various UI components. This makes it impossible to reason about the app's navigation flow.
    *   **Senior Lead Tip:** Channel *all* navigation triggers through a single `NavigationManager`. UI components call a method on the manager (e.g., `navigationManager.navigateTo(Route.Detail("xyz"))`), and the manager updates its state.

3.  **Mutable Navigation State in Composables:**
    *   **The Nightmare:** Using `remember { mutableStateOf(...) }` directly within a composable to manage navigation destinations. This state is lost on configuration changes or process death and isn't observable by other parts of the app.
    *   **Senior Lead Tip:** Navigation state should live in an `Observable` holder (ViewModel, `NavigationManager` with `StateFlow`), not in transient composable state.

4.  **Ignoring `popUpTo` and `saveState`/`restoreState`:**
    *   **The Nightmare:** Allowing the back stack to grow indefinitely or failing to restore state after process death, leading to a confusing user experience.
    *   **Senior Lead Tip:** Understand and leverage `popUpTo` for clearing specific parts of the back stack (e.g., `inclusive = true` for single-top destinations) and always configure `saveState` and `restoreState` on your `NavController` within the `LaunchedEffect` for robust state management.

5.  **Hardcoded Route Paths:**
    *   **The Nightmare:** Using string literals like `"detail/{itemId}"` directly in `navigate()` calls across the codebase. This is error-prone and difficult to refactor.
    *   **Senior Lead Tip:** Define all routes as `sealed class` constants (like our `Route` example) with associated path builders. This provides compile-time safety and a single source of truth for all navigation destinations.

### Wrap Up & The 2026 Roadmap

The transition to a state-driven navigation model with Nav3 is not merely an upgrade; it's an architectural evolution. By embracing this pattern, we're building applications that are inherently more robust, maintainable, and scalable. We're moving towards a future where our UI logic is purely a reaction to observable state, making our codebase cleaner and our development cycles more predictable.

Looking ahead to 2026, this foundation sets us up for even more advanced architectural patterns:

*   **Kotlin Multiplatform (KMP):** The state-driven nature of Nav3 makes it an excellent candidate for sharing navigation logic across Android and iOS. A common `NavigationManager` and `Route` definitions can be implemented in shared Kotlin code.
*   **On-Device AI Integration:** As AI capabilities become more prevalent on-device, navigation states could be dynamically influenced by context or user intent, managed through our centralized `NavigationManager`.
*   **Modularization:** A clear, state-driven navigation contract makes it easier to build and integrate independent feature modules, where each module exposes its navigation routes to the central manager.

This shift requires a commitment to rethinking how we approach UI and navigation. It’s an investment that pays dividends in the long run, enabling us to build more resilient, adaptable, and high-quality applications. Let's build that future, together.