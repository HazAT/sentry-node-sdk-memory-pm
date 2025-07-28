# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a memory performance benchmarking repository for the Sentry Node.js SDK. Updated in 2025 to benchmark the latest Sentry SDK versions with modern tooling. The Express.js application demonstrates memory usage patterns when testing @sentry/node performance across versions.

## Architecture

- **Main application**: `express.js` - Express server that creates memory-intensive Sentry scopes for benchmarking
- **Memory monitor**: `memory-monitor.js` - Real-time memory and CPU monitoring wrapper
- **Dependencies**: Uses latest @sentry/node SDK (9.42.0) with Express.js framework
- **Benchmarking**: Works with ApacheBench (`ab`) for load testing and `pidusage` for monitoring

## Development Commands

```bash
# Start with real-time memory monitoring (recommended)
npm run start:memory

# Start with Node.js inspector for Chrome DevTools
npm run start:inspect

# Run ApacheBench load test (after starting server in separate terminal)
npm run ab
# Equivalent to: ab -c 20 -n 1000 http://localhost:3000/

# For intensive benchmarking (original test parameters)
ab -c 20 -n 10000 http://localhost:3000/
```

## Setup Requirements

1. **Node.js Version**: 20.19.3+ (managed via Volta, pinned in package.json)
2. **DSN Configuration**: Replace `YOUR_DSN` in `express.js:7` with actual Sentry DSN
3. **ApacheBench**: Install `ab` (Apache HTTP server benchmarking tool) for load testing

## Key Implementation Details (Updated 2025)

- **Sentry Integration**: Uses modern SDK with `Sentry.withScope()` and `Sentry.setupExpressErrorHandler()`
- **Memory Pressure**: Generates 5000 properties with large string arrays in Sentry scopes per request
- **Error Handling**: Main handler at `/` throws errors to trigger Sentry reporting
- **Monitoring**: Uses `pidusage` for cross-platform memory/CPU monitoring (replaces deprecated `memory-usage`)
- **Port**: Runs on port 3000 by default

## Testing Workflow

1. Configure Sentry DSN in `express.js:7`
2. Start server: `npm run start:memory` (shows real-time stats)
3. In separate terminal, run: `npm run ab` for load testing
4. Monitor output for memory usage patterns and performance metrics

## Performance Expectations

Based on historical benchmarks, expect significant improvements with modern Sentry SDK:
- **Memory reduction**: 70-80% less peak memory usage vs older versions
- **Throughput**: 25-30% more requests per second
- **CPU efficiency**: Better error handling with OpenTelemetry integration

## Dependencies (Updated)

- `@sentry/node`: 9.42.0 - Latest Sentry SDK for error reporting
- `express`: 4.16.4 - Web framework (kept for compatibility)
- `pidusage`: 3.0.2 - Modern memory/CPU profiling tool

## Modern Sentry API Changes

- `Sentry.configureScope()` → `Sentry.withScope()` (deprecated in v7.89.0)
- `Sentry.Handlers.requestHandler()` → `Sentry.setupExpressErrorHandler()` (new in v9.x)
- Added `sendDefaultPii: true` and `tracesSampleRate: 1.0` for comprehensive monitoring