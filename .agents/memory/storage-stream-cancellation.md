---
name: Storage stream cancellation
description: GCS SDK cancellation race can crash the entire posts service.
---
Do not use the GCS SDK's createReadStream directly as a pipeline source for client-cancelable video responses.

**Why:** On the installed GCS SDK, a client disconnect can destroy the source before a delayed upstream response arrives. The SDK's internal onResponse pipeline then throws ERR_STREAM_UNABLE_TO_PIPE outside the route's promise handling, killing Node and making all posts unavailable.

**How to apply:** Serve media through a server-only signed GET and abortable fetch with standard Node/Web streams. Keep signed URLs private. Register cancellation before asynchronous work, validate range and byte-length responses, and regression-test disconnects before headers and during streaming. Never mask this failure with a global uncaught-exception handler.