# Buraq Guardian — IoT Device Integration Guide

**Version:** 1.0  
**Base URL:** `https://schiiphaalayn.com.ng/api`  
**Last Updated:** March 2026

---

## Overview

This document describes how to integrate a drowning detection IoT device with the Buraq Guardian platform. When the device detects a drowning event, it sends an HTTP request to the server, which then:

1. Validates the device's subscription status
2. Creates a database alert record
3. Sends push notifications to all registered devices for that product
4. Triggers a full-screen alarm on the user's web app

---

## Prerequisites

- The device must have a **Product ID** — a unique identifier registered in the Buraq Guardian system
- The device must have internet connectivity (Wi-Fi, GSM, etc.)
- The product must have an **active subscription** — alerts are rejected if the subscription is expired or inactive

---

## API Endpoints

### 1. Trigger Drowning Alert

Sends a drowning alert to the platform.

**Endpoint:**  
```
POST /alerts/trigger.php
```

**Full URL:**  
```
https://schiiphaalayn.com.ng/api/alerts/trigger.php
```

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "product_id": "BRQ-XXXX-XXXX",
  "message": "DROWNING DETECTED! Immediate action required!"
}
```

| Field        | Type   | Required | Description                                      |
|-------------|--------|----------|--------------------------------------------------|
| `product_id` | string | ✅ Yes   | The unique product ID printed on the device       |
| `message`    | string | ❌ No    | Custom alert message (default: "DROWNING DETECTED!") |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Drowning alert triggered successfully",
  "data": {
    "alert_id": 42,
    "push": {
      "sent": 3,
      "failed": 0
    }
  }
}
```

**Error Responses:**

| Status | Reason                        |
|--------|-------------------------------|
| 400    | Missing `product_id`          |
| 404    | Product ID not registered      |
| 403    | No active subscription         |
| 405    | Wrong HTTP method (must be POST) |
| 500    | Server error                   |

---

### 2. Check Subscription Status

Verify whether a device has an active subscription before sending alerts.

**Endpoint:**  
```
GET /subscriptions/status.php?product_id=BRQ-XXXX-XXXX
```

**Full URL:**  
```
https://schiiphaalayn.com.ng/api/subscriptions/status.php?product_id=BRQ-XXXX-XXXX
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Subscription active",
  "data": {
    "can_activate": true,
    "subscription": {
      "id": "12",
      "plan_name": "6 Months",
      "start_date": "2026-03-01 00:00:00",
      "end_date": "2026-09-01 00:00:00",
      "status": "active",
      "days_remaining": 174,
      "total_days": 184
    }
  }
}
```

Use the `can_activate` field to determine if the device should be operational.

---

## Recommended Device Firmware Flow

```
┌─────────────────────────┐
│   Device Powers On      │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ GET /subscriptions/     │
│ status.php?product_id=X │
└──────────┬──────────────┘
           │
     ┌─────┴─────┐
     │can_activate│
     │  = true?   │
     └─────┬─────┘
       Yes │        No
           │         │
           ▼         ▼
   ┌──────────┐  ┌────────────┐
   │ Enable   │  │ Disable    │
   │ Sensors  │  │ Monitoring │
   │ & Monitor│  │ Show LED   │
   └────┬─────┘  └────────────┘
        │
        ▼ (drowning detected)
┌─────────────────────────┐
│ POST /alerts/trigger.php│
│ { product_id, message } │
└─────────────────────────┘
```

---

## Implementation Example (Arduino / ESP32)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* PRODUCT_ID = "BRQ-XXXX-XXXX";
const char* API_BASE = "https://schiiphaalayn.com.ng/api";

// Check subscription on boot
bool checkSubscription() {
    HTTPClient http;
    String url = String(API_BASE) + "/subscriptions/status.php?product_id=" + PRODUCT_ID;
    http.begin(url);
    
    int httpCode = http.GET();
    if (httpCode == 200) {
        String payload = http.getString();
        StaticJsonDocument<512> doc;
        deserializeJson(doc, payload);
        return doc["data"]["can_activate"].as<bool>();
    }
    return false;
}

// Trigger alert when drowning detected
void triggerAlert() {
    HTTPClient http;
    String url = String(API_BASE) + "/alerts/trigger.php";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<200> doc;
    doc["product_id"] = PRODUCT_ID;
    doc["message"] = "DROWNING DETECTED! Immediate action required!";
    
    String body;
    serializeJson(doc, body);
    
    int httpCode = http.POST(body);
    // httpCode 200 = success
}
```

---

## Best Practices

1. **Check subscription on boot** — Call the status endpoint when the device starts up. If `can_activate` is `false`, disable monitoring and indicate via LED.

2. **Periodic re-check** — Re-check subscription every 24 hours in case it expires while the device is running.

3. **Retry logic** — If the trigger request fails (network error, 500), retry up to 3 times with 2-second delays.

4. **Debounce alerts** — Avoid sending multiple alerts within a short window (e.g., minimum 30 seconds between triggers).

5. **HTTPS required** — All API calls must use HTTPS. The server does not accept plain HTTP.

6. **Product ID** — The product ID is printed on the device packaging and registered by the user during account setup. It must match exactly.

---

## Support

For API issues or integration help, contact the Buraq Guardian development team.
