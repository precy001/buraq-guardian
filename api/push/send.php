<?php
// Send Web Push notifications for a product
// Called internally by trigger.php when a drowning alert is created

require_once __DIR__ . '/../config/database.php';

function sendPushNotifications($product_id, $message) {
    try {
        $db = getDBConnection();

        // Check if push_subscriptions table exists
        $stmt = $db->query("SHOW TABLES LIKE 'push_subscriptions'");
        if ($stmt->rowCount() === 0) return;

        // Get all subscriptions for this product
        $stmt = $db->prepare("SELECT * FROM push_subscriptions WHERE product_id = :product_id");
        $stmt->execute(['product_id' => $product_id]);
        $subscriptions = $stmt->fetchAll();

        if (empty($subscriptions)) return;

        $vapidPrivateKey = getenv('VAPID_PRIVATE_KEY');
        $vapidPublicKey = getenv('VAPID_PUBLIC_KEY');

        if (!$vapidPrivateKey || !$vapidPublicKey) {
            error_log('VAPID keys not configured — cannot send push notifications');
            return;
        }

        $payload = json_encode([
            'title' => '🚨 DROWNING ALERT!',
            'body' => $message,
            'icon' => '/pwa-192x192.png',
            'badge' => '/pwa-192x192.png',
            'tag' => 'drowning-alert',
        ]);

        foreach ($subscriptions as $sub) {
            try {
                sendWebPush(
                    $sub['endpoint'],
                    $sub['p256dh'],
                    $sub['auth'],
                    $payload,
                    $vapidPublicKey,
                    $vapidPrivateKey
                );
            } catch (Exception $e) {
                error_log('Push notification failed for endpoint: ' . $sub['endpoint'] . ' - ' . $e->getMessage());

                // Remove invalid subscriptions (410 Gone)
                if (strpos($e->getMessage(), '410') !== false || strpos($e->getMessage(), '404') !== false) {
                    $delStmt = $db->prepare("DELETE FROM push_subscriptions WHERE id = :id");
                    $delStmt->execute(['id' => $sub['id']]);
                }
            }
        }
    } catch (Exception $e) {
        error_log('sendPushNotifications error: ' . $e->getMessage());
    }
}

function sendWebPush($endpoint, $p256dh, $auth, $payload, $vapidPublicKey, $vapidPrivateKey) {
    // Use web-push-php library if available, otherwise use raw cURL
    // For simplicity, using cURL with raw push (works for most browsers)

    $headers = [
        'Content-Type: application/json',
        'TTL: 86400',
    ];

    // Create JWT for VAPID authentication
    $audience = parse_url($endpoint, PHP_URL_SCHEME) . '://' . parse_url($endpoint, PHP_URL_HOST);

    $header = base64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $jwtPayload = base64url_encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 86400,
        'sub' => 'mailto:admin@schipha.com',
    ]));

    $signingInput = "$header.$jwtPayload";

    // Sign with VAPID private key
    $privateKeyPem = "-----BEGIN EC PRIVATE KEY-----\n" .
        chunk_split(base64_encode(hex2bin(
            '30770201010420' . bin2hex(base64url_decode($vapidPrivateKey)) .
            'a00a06082a8648ce3d030107a14403420004' .
            bin2hex(base64url_decode($vapidPublicKey))
        )), 64, "\n") .
        "-----END EC PRIVATE KEY-----";

    $key = openssl_pkey_get_private($privateKeyPem);
    if ($key === false) {
        // Fallback: send without VAPID (may work for some endpoints)
        error_log('VAPID key parsing failed, sending without auth');
        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) {
            throw new Exception("Push failed with HTTP $httpCode: $response");
        }
        return;
    }

    openssl_sign($signingInput, $signature, $key, OPENSSL_ALGO_SHA256);
    $jwt = "$signingInput." . base64url_encode($signature);

    $headers[] = "Authorization: vapid t=$jwt, k=$vapidPublicKey";

    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 400) {
        throw new Exception("Push failed with HTTP $httpCode: $response");
    }
}

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}
