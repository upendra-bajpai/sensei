---
layout: post
title: Web Servers Reverse Proxy vs Forward Proxy - Implementation with Nginx (LLD)
author: jane
date: 2026-02-01 09:00:00
categories: [ servers, LLD, system-design ]
image: /assets/images/2026-02-01-web-servers-reverse-proxy-vs-forward-proxy-implementation-with-nginx-lld-diagram-1.png
---

Let's break down how to implement a reverse proxy and a forward proxy using Nginx. These are fundamental components in network architecture, and understanding their implementation helps solidify concepts around traffic management and security.

### Understanding the Core Concepts

Before diving into Nginx configuration, it's crucial to grasp the distinct roles of forward and reverse proxies.

*   **Forward Proxy:** Acts on behalf of *clients*. When a client wants to access a resource on the internet, its request goes through the forward proxy first. The proxy then forwards the request to the target server, effectively masking the client's identity and often enforcing access policies or caching. Think of it as a gatekeeper for outbound traffic.

*   **Reverse Proxy:** Acts on behalf of *servers*. When a client requests a resource from a server, the request first hits the reverse proxy. The proxy then forwards the request to one or more backend servers, typically distributing the load or providing a single point of access. It shields the backend servers and can offer services like SSL termination, caching, and compression. Think of it as a front-door manager for your servers.

### Implementing a Reverse Proxy with Nginx

A reverse proxy is a very common use case for Nginx. It's used to direct client requests to one or more backend application servers.

#### Requirements
*   Nginx installed and running.
*   One or more backend application servers accessible from the Nginx server.

#### Core Objects

| Object Type     | Name                                 | Description                                                                                                                                                                                                                                                            | Relationships                               |
| :-------------- | :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------ |
| **Directive**   | `http`                               | The main context for HTTP server configurations. All HTTP-specific settings go within this block.                                                                                                                                                                          | Contains `server` blocks.                   |
| **Directive**   | `server`                             | Defines a virtual server that listens on specific IP addresses and ports, handling requests for specific hostnames.                                                                                                                                                     | Contains `location` blocks.                 |
| **Directive**   | `location`                           | Matches requests based on their URI and applies specific configurations (like proxying, static file serving, etc.).                                                                                                                                                      | Can contain other directives.               |
| **Directive**   | `upstream`                           | Defines a group of backend servers that Nginx can proxy requests to. It allows for load balancing and health checks.                                                                                                                                                      | Contains `server` directives for backends.  |
| **Directive**   | `proxy_pass`                         | Forwards a request to an upstream server defined in an `upstream` block or directly specified.                                                                                                                                                                           | Used within `location` blocks.              |
| **Directive**   | `proxy_set_header`                   | Modifies or adds headers to the request being proxied to the backend server. Crucial for passing client information.                                                                                                                                                    | Used within `location` blocks.              |
| **Variable**    | `$host`                              | Represents the `Host` header from the client's request.                                                                                                                                                                                                                | Used with `proxy_set_header`.               |
| **Variable**    | `$remote_addr`                       | Represents the IP address of the client.                                                                                                                                                                                                                               | Used with `proxy_set_header`.               |
| **Variable**    | `$scheme`                            | Represents the protocol used by the client (e.g., `http` or `https`).                                                                                                                                                                                                  | Used with `proxy_set_header`.               |
| **Configuration** | `nginx.conf`                         | The primary configuration file for Nginx.                                                                                                                                                                                                                              | Holds all directives and blocks.            |
| **Process**     | `nginx master process`               | Manages worker processes and configuration.                                                                                                                                                                                                                            | Manages worker processes.                   |
| **Process**     | `nginx worker process`                | Handles client requests and their associated I/O operations.                                                                                                                                                                                                           | Handles connections.                        |

#### Interaction Logic

Let's trace a typical request flow when Nginx acts as a reverse proxy.

1.  **Client Initiates Request:** A client (e.g., a web browser) sends an HTTP request to Nginx, typically to a public IP address and port (e.g., `http://yourdomain.com`).

2.  **Nginx Master Process:** The Nginx master process is listening on the specified port. It reads the `nginx.conf` file.

3.  **Server Block Matching:** The master process identifies the appropriate `server` block based on the `server_name` directive and the `listen` directive that matches the incoming request's IP address and port.

4.  **Location Block Matching:** Within the matched `server` block, Nginx finds the `location` block that best matches the request's URI.

5.  **Upstream Selection:** If the `location` block contains a `proxy_pass` directive pointing to an `upstream` block, Nginx selects a backend server from that upstream group based on the configured load balancing algorithm (e.g., round-robin, least connections).

6.  **Header Manipulation:** Before forwarding, Nginx might modify or add headers using `proxy_set_header`. Crucially, it sets headers like:
    *   `Host: $host` (passing the original host the client requested)
    *   `X-Real-IP: $remote_addr` (passing the client's actual IP address)
    *   `X-Forwarded-For: $proxy_add_x_forwarded_for` (a list of IPs if there are multiple proxies)
    *   `X-Forwarded-Proto: $scheme` (indicating if the original request was HTTP or HTTPS)

7.  **Worker Process Handles Proxying:** A worker process takes over to establish a connection to the selected backend server and forwards the modified request.

8.  **Backend Server Processes Request:** The backend server receives the proxied request, processes it, and sends a response back to Nginx.

9.  **Nginx Returns Response:** The Nginx worker process receives the backend's response and forwards it back to the original client.

#### Design Patterns: `upstream` and `proxy_pass`

The `upstream` block combined with `proxy_pass` within `location` blocks is Nginx's primary mechanism for implementing reverse proxy functionality. This pattern encapsulates the logic for routing and load balancing, promoting modularity. The `proxy_set_header` directive is essential for maintaining context (like client IP and original host) as requests traverse proxies.

<img src="/assets/images/2026-02-01-web-servers-reverse-proxy-vs-forward-proxy-implementation-with-nginx-lld-diagram-1.png" alt="System Architecture Diagram 1" style="max-width: 100%; height: auto; display: block; margin: 20px auto;" />

### Implementing a Forward Proxy with Nginx

While Nginx is more commonly known as a reverse proxy, it can also be configured as a forward proxy. This involves setting up Nginx to relay requests from internal clients to external servers.

#### Requirements
*   Nginx installed and running.
*   Clients configured to use Nginx as their proxy server.

#### Core Objects

| Object Type     | Name                                 | Description                                                                                                                                                                                                                                                            | Relationships                               |
| :-------------- | :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------ |
| **Directive**   | `http`                               | The main context for HTTP server configurations.                                                                                                                                                                                                                         | Contains `server` blocks.                   |
| **Directive**   | `server`                             | Defines a virtual server that listens on specific IP addresses and ports. For a forward proxy, this block will handle client connections.                                                                                                                                 | Contains `location` blocks.                 |
| **Directive**   | `location`                           | Matches requests based on their URI. In a forward proxy, this often uses a catch-all pattern.                                                                                                                                                                          | Can contain other directives.               |
| **Directive**   | `proxy_pass`                         | Forwards a request to a target server. In a forward proxy context, this directive is often used with variables that dynamically determine the destination URL based on the client's request.                                                                              | Used within `location` blocks.              |
| **Directive**   | `proxy_set_header`                   | Modifies or adds headers to the request being forwarded. Crucial for passing client information or modifying headers before they reach the internet.                                                                                                                       | Used within `location` blocks.              |
| **Directive**   | `resolver`                           | Specifies DNS servers that Nginx should use to resolve hostnames dynamically. Essential for forward proxies where target hostnames are not known statically.                                                                                                                 | Used within `http` or `server` blocks.      |
| **Variable**    | `$http_host`                         | Represents the `Host` header from the client's request. This is typically the external domain the client wants to access.                                                                                                                                               | Used with `proxy_pass`.                     |
| **Variable**    | `$request_uri`                       | Represents the full original request URI, including the path and query string.                                                                                                                                                                                         | Used with `proxy_pass`.                     |
| **Variable**    | `$scheme`                            | Represents the protocol used by the client.                                                                                                                                                                                                                            | Used with `proxy_pass`.                     |
| **Configuration** | `nginx.conf`                         | The primary configuration file for Nginx.                                                                                                                                                                                                                              | Holds all directives and blocks.            |
| **Process**     | `nginx master process`               | Manages worker processes and configuration.                                                                                                                                                                                                                            | Manages worker processes.                   |
| **Process**     | `nginx worker process`                | Handles client connections and forwards requests to external servers.                                                                                                                                                                                                  | Handles connections.                        |

#### Interaction Logic

Here's how a request flows when Nginx operates as a forward proxy:

1.  **Client Configures Proxy:** A client's network settings are configured to use Nginx (e.g., `proxy.example.com:8080`) as its HTTP proxy.

2.  **Client Sends CONNECT Request (for HTTPS) or Direct Request (for HTTP):**
    *   **For HTTP:** The client sends a standard HTTP request, but with the `Host` header specifying the *external* target server (e.g., `GET /index.html HTTP/1.1\nHost: www.example.com`).
    *   **For HTTPS:** The client sends an HTTP `CONNECT` request to the proxy, specifying the target server and port (e.g., `CONNECT www.example.com:443 HTTP/1.1\nHost: www.example.com:443`).

3.  **Nginx Worker Processes Request:** An Nginx worker process receives the request. It matches this request to a `server` and `location` block.

4.  **Dynamic Resolution:** Because the target server is external and determined by the client's request, Nginx needs to resolve the hostname dynamically. The `resolver` directive is crucial here, telling Nginx which DNS servers to use.

5.  **Proxying the Request:** The `proxy_pass` directive is configured to use variables that construct the target URL. A common pattern is:
    ```nginx
    proxy_pass $scheme://$http_host$request_uri;
    ```
    *   `$scheme` captures `http` or `https` from the client's request.
    *   `$http_host` captures the target hostname and port from the client's `Host` header (or the `CONNECT` target).
    *   `$request_uri` captures the requested path and query string.

6.  **Header Management:** `proxy_set_header` directives are used to pass relevant information. For a forward proxy, it's common to pass the original `Host` header to the upstream server.

7.  **Establishing Connection to External Server:** Nginx establishes a connection to the resolved external server's IP address and port.

8.  **Forwarding Data:** Nginx forwards the client's request (or the established tunnel for HTTPS) to the external server.

9.  **Receiving Response:** Nginx receives the response from the external server.

10. **Returning Response to Client:** Nginx sends the response back to the client. For HTTPS `CONNECT` requests, Nginx simply tunnels the encrypted data back and forth.

#### Design Patterns: `proxy_pass` with Variables and `resolver`

The core of Nginx as a forward proxy relies on its ability to dynamically determine the upstream server using variables within the `proxy_pass` directive. The `resolver` directive is a critical companion, enabling Nginx to perform DNS lookups on demand for these dynamically determined upstream hosts. This pattern allows Nginx to act as a generic proxy for any external resource the client requests.

<img src="/assets/images/2026-02-01-web-servers-reverse-proxy-vs-forward-proxy-implementation-with-nginx-lld-diagram-2.png" alt="System Architecture Diagram 2" style="max-width: 100%; height: auto; display: block; margin: 20px auto;" />

### Refinement and Edge Cases

When implementing either type of proxy with Nginx, consider these points:

*   **SSL/TLS Handling:**
    *   **Reverse Proxy:** Nginx can terminate SSL (decrypting traffic) and forward unencrypted traffic to backends, or it can re-encrypt traffic to backends. The `ssl_certificate` and `ssl_certificate_key` directives are key here.
    *   **Forward Proxy:** For HTTPS traffic, Nginx typically uses the `CONNECT` method to establish a tunnel. It doesn't decrypt the traffic itself but relays the encrypted data. If Nginx needs to inspect or modify HTTPS traffic (e.g., for content filtering), it would require SSL interception, which involves a Man-in-the-Middle approach with its own set of certificate management complexities and security implications.

*   **Load Balancing Algorithms:** For reverse proxies, choosing the right load balancing algorithm (`round-robin`, `least_conn`, `ip_hash`) is crucial for distributing traffic effectively and maintaining session persistence if needed.

*   **Buffering and Timeouts:** Directives like `proxy_buffering`, `proxy_read_timeout`, `proxy_connect_timeout`, and `proxy_send_timeout` are vital for managing how Nginx interacts with backend servers and clients. Tuning these can prevent errors and improve performance.

*   **Security:**
    *   **Reverse Proxy:** Implement access controls (`allow`, `deny`), rate limiting (`limit_req_zone`), and strong SSL configurations.
    *   **Forward Proxy:** Access control (`allow`, `deny`) is critical to restrict which clients can use the proxy. You might also implement authentication (`auth_basic`) or block specific domains (`server_name` with a `return 444;` or by filtering `proxy_pass` destinations).

*   **Concurrency:** Nginx's event-driven model is inherently good at handling concurrency. However, for extremely high loads, tuning `worker_processes` and `worker_connections` in `nginx.conf` is necessary. Ensure the OS limits on file descriptors (`ulimit -n`) are also increased.

*   **Failure Handling:**
    *   **Reverse Proxy:** Use `upstream` blocks with `health_check` directives (in Nginx Plus) or passive health checks (like `max_fails` and `fail_timeout` in Open Source Nginx) to automatically remove unhealthy backend servers from the pool.
    *   **Forward Proxy:** If the external server is unreachable or times out, Nginx will return an error to the client. The `resolver` timeouts also play a role here.

By understanding these configurations and patterns, you can effectively leverage Nginx for both reverse and forward proxy functionalities, building robust and scalable network infrastructures.