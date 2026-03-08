<?php
// Send Web Push notifications for a product
// Called internally by trigger.php when a drowning alert is created

require_once __DIR__ . '/../config/database.php';

function sendPushNotifications($product_id, $message) {
    $stats = [
        'attempted' => 0,
        'sent' => 0,
        'failed' => 0,
        'errors' => [],
    ];

    try {
        $db = getDBConnection();

        // Check if push_subscriptions table exists
        $stmt = $db->query("SHOW TABLES LIKE 'push_subscriptions'");
        if ($stmt->rowCount() === 0) {
            $stats['errors'][] = 'push_subscriptions table not found';
            return $stats;
        }

        // Get all subscriptions for this product
        $stmt = $db->prepare("SELECT * FROM push_subscriptions WHERE product_id = :product_id");
        $stmt->execute(['product_id' => $product_id]);
        $subscriptions = $stmt->fetchAll();

        if (empty($subscriptions)) {
            $stats['errors'][] = 'No push subscriptions for product';
            return $stats;
        }

        $vapidPrivateKey = getenv('VAPID_PRIVATE_KEY');
        $vapidPublicKey = getenv('VAPID_PUBLIC_KEY');

        if (!$vapidPrivateKey || !$vapidPublicKey) {
            $stats['errors'][] = 'VAPID keys not configured';
            error_log('VAPID keys not configured — cannot send push notifications');
            return $stats;
        }

        $payload = json_encode([
            'title' => '🚨 DROWNING ALERT!',
            'body' => $message,
            'icon' => '/pwa-192x192.png',
            'badge' => '/pwa-192x192.png',
            'tag' => 'drowning-alert',
        ], JSON_UNESCAPED_UNICODE);

        foreach ($subscriptions as $sub) {
            $stats['attempted']++;

            try {
                sendWebPush(
                    $sub['endpoint'],
                    $sub['p256dh'],
                    $sub['auth'],
                    $payload,
                    $vapidPublicKey,
                    $vapidPrivateKey
                );
                $stats['sent']++;
            } catch (Exception $e) {
                $stats['failed']++;
                $stats['errors'][] = $e->getMessage();
                error_log('Push notification failed for endpoint: ' . $sub['endpoint'] . ' - ' . $e->getMessage());

                // Remove invalid subscriptions
                if (strpos($e->getMessage(), '410') !== false || strpos($e->getMessage(), '404') !== false) {
                    $delStmt = $db->prepare("DELETE FROM push_subscriptions WHERE id = :id");
                    $delStmt->execute(['id' => $sub['id']]);
                }
            }
        }
    } catch (Exception $e) {
        $stats['errors'][] = $e->getMessage();
        error_log('sendPushNotifications error: ' . $e->getMessage());
    }

    return $stats;
}

function sendWebPush($endpoint, $p256dh, $auth, $payload, $vapidPublicKey, $vapidPrivateKey) {
    if (!$endpoint || !$p256dh || !$auth) {
        throw new Exception('Invalid push subscription data');
    }

    $audience = parse_url($endpoint, PHP_URL_SCHEME) . '://' . parse_url($endpoint, PHP_URL_HOST);
    $jwt = createVapidJwt($audience, $vapidPublicKey, $vapidPrivateKey);

    $encrypted = encryptWebPushPayload($payload, $p256dh, $auth, $vapidPublicKey, $vapidPrivateKey);

    $headers = [
        'TTL: 60',
        'Urgency: high',
        'Content-Encoding: aes128gcm',
        'Content-Type: application/octet-stream',
        'Authorization: vapid t=' . $jwt . ', k=' . $vapidPublicKey,
        'Content-Length: ' . strlen($encrypted),
    ];

    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $encrypted);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        throw new Exception('cURL error: ' . $curlError);
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        throw new Exception("Push failed with HTTP $httpCode: $response");
    }
}

function encryptWebPushPayload($payload, $userPublicKeyB64, $userAuthB64, $vapidPublicKeyB64 = null, $vapidPrivateKeyB64 = null) {
    $userPublicKey = base64url_decode($userPublicKeyB64);
    $userAuth = base64url_decode($userAuthB64);

    if (strlen($userPublicKey) !== 65) {
        throw new Exception('Invalid user public key length');
    }

    [$serverKey, $serverPublicKey] = createSenderKeyPair($vapidPublicKeyB64, $vapidPrivateKeyB64);

    $userPublicPem = ecPublicKeyToPem($userPublicKey);
    $userPublic = openssl_pkey_get_public($userPublicPem);
    if (!$userPublic) {
        throw new Exception('Invalid user public key');
    }

    $sharedSecret = openssl_pkey_derive($userPublic, $serverKey, 32);
    if ($sharedSecret === false) {
        throw new Exception('ECDH derivation failed: ' . collectOpenSslErrors());
    }

    // RFC 8291
    $prkKey = hash_hmac('sha256', $sharedSecret, $userAuth, true);
    $keyInfo = "WebPush: info\x00" . $userPublicKey . $serverPublicKey;
    $ikm = hkdfExpand($prkKey, $keyInfo, 32);

    // RFC 8188 (aes128gcm)
    $salt = random_bytes(16);
    $contentPrk = hash_hmac('sha256', $ikm, $salt, true);
    $cek = hkdfExpand($contentPrk, "Content-Encoding: aes128gcm\x00", 16);
    $nonce = hkdfExpand($contentPrk, "Content-Encoding: nonce\x00", 12);

    $plaintext = $payload . "\x02";
    $ciphertext = openssl_encrypt(
        $plaintext,
        'aes-128-gcm',
        $cek,
        OPENSSL_RAW_DATA,
        $nonce,
        $tag,
        '',
        16
    );

    if ($ciphertext === false) {
        throw new Exception('Payload encryption failed');
    }

    $recordSize = 4096;
    $header = $salt . pack('N', $recordSize) . chr(strlen($serverPublicKey)) . $serverPublicKey;

    return $header . $ciphertext . $tag;
}

function createVapidJwt($audience, $vapidPublicKey, $vapidPrivateKey) {
    $header = base64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $payload = base64url_encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 12 * 60 * 60,
        'sub' => 'mailto:admin@schipha.com',
    ]));

    $signingInput = $header . '.' . $payload;
    $privatePem = vapidPrivateKeyToPem($vapidPrivateKey, $vapidPublicKey);
    $privateKey = openssl_pkey_get_private($privatePem);

    if (!$privateKey) {
        throw new Exception('Invalid VAPID private key');
    }

    $signed = openssl_sign($signingInput, $derSignature, $privateKey, OPENSSL_ALGO_SHA256);
    if (!$signed) {
        throw new Exception('Failed to sign VAPID JWT');
    }

    $joseSignature = derToJose($derSignature, 64);

    return $signingInput . '.' . base64url_encode($joseSignature);
}

function vapidPrivateKeyToPem($privateKeyB64Url, $publicKeyB64Url) {
    if (strpos($privateKeyB64Url, 'BEGIN EC PRIVATE KEY') !== false) {
        return $privateKeyB64Url;
    }

    $privateRaw = base64url_decode($privateKeyB64Url);
    $publicRaw = base64url_decode($publicKeyB64Url);

    if (strlen($privateRaw) !== 32 || strlen($publicRaw) !== 65) {
        throw new Exception('Invalid VAPID key lengths');
    }

    // ASN.1 DER for SEC1 EC private key (prime256v1)
    $der = hex2bin('30770201010420')
        . $privateRaw
        . hex2bin('a00a06082a8648ce3d030107a144034200')
        . $publicRaw;

    return pemEncode('EC PRIVATE KEY', $der);
}

function ecPublicKeyToPem($rawPublicKey) {
    // ASN.1 DER SubjectPublicKeyInfo prefix for P-256 key
    $spkiPrefix = hex2bin('3059301306072A8648CE3D020106082A8648CE3D030107034200');
    return pemEncode('PUBLIC KEY', $spkiPrefix . $rawPublicKey);
}

function pemEncode($type, $derBytes) {
    return "-----BEGIN $type-----\n"
        . chunk_split(base64_encode($derBytes), 64, "\n")
        . "-----END $type-----\n";
}

function hkdfExpand($prk, $info, $length) {
    $output = '';
    $block = '';
    $counter = 1;

    while (strlen($output) < $length) {
        $block = hash_hmac('sha256', $block . $info . chr($counter), $prk, true);
        $output .= $block;
        $counter++;
    }

    return substr($output, 0, $length);
}

function derToJose($derSignature, $outputLength = 64) {
    $partLength = intdiv($outputLength, 2);

    $pos = 0;
    if (ord($derSignature[$pos++]) !== 0x30) {
        throw new Exception('Invalid DER signature format');
    }

    $seqLen = ord($derSignature[$pos++]);
    if ($seqLen & 0x80) {
        $seqLenBytes = $seqLen & 0x1F;
        $seqLen = 0;
        for ($i = 0; $i < $seqLenBytes; $i++) {
            $seqLen = ($seqLen << 8) | ord($derSignature[$pos++]);
        }
    }

    if (ord($derSignature[$pos++]) !== 0x02) {
        throw new Exception('Invalid DER signature format (R)');
    }
    $rLen = ord($derSignature[$pos++]);
    $r = substr($derSignature, $pos, $rLen);
    $pos += $rLen;

    if (ord($derSignature[$pos++]) !== 0x02) {
        throw new Exception('Invalid DER signature format (S)');
    }
    $sLen = ord($derSignature[$pos++]);
    $s = substr($derSignature, $pos, $sLen);

    $r = ltrim($r, "\x00");
    $s = ltrim($s, "\x00");

    $r = str_pad($r, $partLength, "\x00", STR_PAD_LEFT);
    $s = str_pad($s, $partLength, "\x00", STR_PAD_LEFT);

    return $r . $s;
}

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}
