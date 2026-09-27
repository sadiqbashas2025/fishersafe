# FisherSafe — Offline Fisherman Maritime Safety

## Run locally

Requirements: Node.js 18+.

```bash
npm install
npm start
```

Open `http://localhost:3000`.

For phone testing on the same Wi-Fi, expose the server on the LAN and use HTTPS if your
browser requires a secure context for geolocation. `localhost` is normally allowed.

## Real GPS / GNSS

The app requests high-accuracy device geolocation. On a real Android phone this can use the
phone's GNSS receiver. Browser JavaScript cannot directly connect to satellites or read raw
satellite signals.

The project includes an optional native GNSS bridge contract in `native-gnss-bridge/`.

## Offline operation

The safety calculation, alert logic, local storage, trip history and boundary geometry run
locally. Previously viewed map tiles may be cached by the service worker. This is NOT the same
as bundling a complete offline nautical chart.

If internet is unavailable, the map still displays the local boundary/vector layers, GPS position,
distance calculation and alerts.

## Boundary safety

The IMBL dataset in this demo is simplified and intended for a hackathon/prototype. It must not
be used as a legal navigation chart or sole source of navigation decisions.

## Demo mode

If the browser has no geolocation support or permission, the app falls back to clearly labelled
SIMULATION mode. Use the Utilities/Navigation screens to verify the UI and boundary alert flow.

## Main features

- Real device high-accuracy GPS/GNSS position
- Local India–Sri Lanka boundary proximity calculation
- 50 km / 20 km / 5 km warning levels
- Boundary-crossing side check
- Audio + vibration alerts
- Offline local storage for logs
- SOS local event logging
- Trip history and waypoints
- Admin/fisherman authentication API
- PWA service worker
- Optional native GNSS metadata bridge

## v4 — Agentic Marine Intelligence
This build adds a provider-neutral collaborative-agent layer for the ORCA-style marine intelligence requirements:
- Planner Agent: intent classification and task decomposition
- Weather Agent: wind/rain/lightning/cyclone reasoning
- Ocean Agent: waves/SST/chlorophyll/tide reasoning
- Geo Agent: GNSS + IMBL/restricted-zone reasoning
- PFZ Agent: Potential Fishing Zone reasoning
- Risk Agent: multi-source risk synthesis

The new **Marine AI** dashboard is a local, deterministic demonstration. It does **not** pretend that live ISRO/INCOIS/weather data is connected. Demo values are explicitly labelled. For production/SIH deployment, replace the provider-neutral data objects in `js/marine-agents.js` with authorized public-domain data/API connectors and add timestamps/source URLs.

### GNSS / satellite clarification
A phone's GNSS receiver can obtain positioning from navigation satellites without mobile internet. A browser cannot directly open a satellite communication link or expose raw satellite counts. The existing `js/gps.js` uses the device Geolocation API and has an optional native bridge for Android GNSS metadata. Live satellite Earth-Observation products are a separate data pipeline and are not available merely because phone GPS is enabled.
