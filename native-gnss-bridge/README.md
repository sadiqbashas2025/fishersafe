# FisherSafe Native GNSS Bridge

## What is actually possible

A phone's GNSS receiver can receive satellite signals (GPS, Galileo, GLONASS, BeiDou and,
on supported devices, NavIC/IRNSS). A normal browser JavaScript application does **not**
get raw satellite/NMEA data or a guaranteed satellite count. It gets a location fix through
the device/browser Geolocation API.

FisherSafe therefore has two layers:

1. **Browser/real-device mode** — `navigator.geolocation` with `enableHighAccuracy: true`.
2. **Optional native Android mode** — an Android WebView can expose GNSS metadata to the page
   through `window.FisherSafeGNSS` or call `window.FisherSafeGNSSReceiver(metadata)`.

The app never fabricates a satellite count. If native metadata is unavailable, the UI says
"GNSS metadata unavailable".

## Native metadata contract

The native wrapper may provide:

```js
window.FisherSafeGNSSReceiver({
  satelliteCount: 12,
  usedSystems: ["GPS", "GALILEO", "NAVIC"],
  hdop: 0.9,
  vdop: 1.2,
  fixType: "excellent",
  gnssSource: "android-fused-gnss"
});
```

Only `satelliteCount`, `usedSystems`, `hdop`, `vdop`, `fixType`, and `gnssSource` are optional.
The location itself should still be supplied through the Android location provider and passed
to the WebView using the normal Geolocation bridge or app-specific interface.

## Important

Do not describe this web build as having a direct satellite internet connection. GNSS satellites
provide positioning; they do not provide an ordinary internet connection to this web app.

For a real field deployment, use an Android/iOS native GNSS layer and an approved offline nautical
chart/data source. The included IMBL coordinates are a safety-demo dataset and must not be treated
as an authoritative legal navigation chart.
