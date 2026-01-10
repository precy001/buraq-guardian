<?php
/**
 * Paystack Payment Verification Endpoint
 * 
 * Verifies payment with Paystack and STACKS subscription duration.
 * Idempotent, retry-safe, production-ready.
 */

require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';

/**
 * --------------------------------------------------
 * METHOD CHECK
 * --------------------------------------------------
 */
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'])) {
    http_response_code(405);
    jsonResponse(false, 'Method not allowed');
}

/**
 * --------------------------------------------------
 * PAYSTACK CONFIG
 * --------------------------------------------------
 */
$paystackSecretKey = "sk_test_61bfc65b453de719dbe11751047a7d69a1fe8725";
if (!$paystackSecretKey) {
    http_response_code(500);
    jsonResponse(false, 'Payment configuration error');
}

/**
 * --------------------------------------------------
 * GET PAYMENT REFERENCE
 * --------------------------------------------------
 */
$reference = $_GET['reference'] ?? null;

if (!$reference && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $reference = $input['reference'] ?? null;
}

if (!$reference) {
    http_response_code(400);
    jsonResponse(false, 'Payment reference is required');
}

$reference = trim($reference);
if (!preg_match('/^[a-zA-Z0-9_-]+$/', $reference)) {
    http_response_code(400);
    jsonResponse(false, 'Invalid reference format');
}

try {

    /**
     * --------------------------------------------------
     * IDEMPOTENCY CHECK (PAYMENT LEVEL)
     * --------------------------------------------------
     */
    $stmt = $pdo->prepare("
        SELECT id 
        FROM subscription_payments 
        WHERE payment_reference = ?
    ");
    $stmt->execute([$reference]);

    if ($stmt->fetch()) {
        jsonResponse(true, 'Payment already processed', [
            'already_processed' => true
        ]);
    }

    /**
     * --------------------------------------------------
     * VERIFY WITH PAYSTACK
     * --------------------------------------------------
     */
    $ch = curl_init('https://api.paystack.co/transaction/verify/' . urlencode($reference));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $paystackSecretKey,
            'Content-Type: application/json'
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT => 30
    ]);

    $response  = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        http_response_code(500);
        jsonResponse(false, 'Payment verification service unavailable');
    }

    $result = json_decode($response, true);

    if ($httpCode !== 200 || empty($result['status'])) {
        http_response_code(400);
        jsonResponse(false, $result['message'] ?? 'Payment verification failed');
    }

    $transaction = $result['data'];

    if ($transaction['status'] !== 'success') {
        http_response_code(400);
        jsonResponse(false, 'Payment not successful');
    }

    if ($transaction['currency'] !== 'NGN') {
        http_response_code(400);
        jsonResponse(false, 'Invalid payment currency');
    }

    /**
     * --------------------------------------------------
     * METADATA VALIDATION
     * --------------------------------------------------
     */
    $metadata     = $transaction['metadata'] ?? [];
    $productId    = $metadata['product_id'] ?? null;
    $planName     = $metadata['plan_name'] ?? null;
    $durationDays = (int) ($metadata['duration_days'] ?? 30);

    if (!$productId || !$planName) {
        http_response_code(400);
        jsonResponse(false, 'Invalid payment metadata');
    }

    /**
     * --------------------------------------------------
     * VERIFY PRODUCT EXISTS
     * --------------------------------------------------
     */
    $stmt = $pdo->prepare("SELECT id FROM users WHERE product_id = ?");
    $stmt->execute([$productId]);

    if (!$stmt->fetch()) {
        http_response_code(404);
        jsonResponse(false, 'Product not found');
    }

    /**
     * --------------------------------------------------
     * ATOMIC DATABASE TRANSACTION
     * --------------------------------------------------
     */
    $pdo->beginTransaction();

    /**
     * 1. RECORD PAYMENT (IDEMPOTENCY GUARANTEE)
     */
    $stmt = $pdo->prepare("
        INSERT INTO subscription_payments (
            payment_reference,
            product_id,
            amount_paid,
            currency,
            paid_at
        ) VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $reference,
        $productId,
        $transaction['amount'],
        $transaction['currency'],
        $transaction['paid_at']
    ]);

    /**
     * 2. STACK SUBSCRIPTION
     */
    $stmt = $pdo->prepare("
        SELECT id, start_date, end_date 
        FROM subscriptions
        WHERE product_id = ? AND status = 'active'
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$productId]);
    $activeSubscription = $stmt->fetch();

    if ($activeSubscription) {
        // Extend existing subscription
        $startDate = $activeSubscription['start_date'];
        $endDate   = date(
            'Y-m-d H:i:s',
            strtotime($activeSubscription['end_date'] . " +{$durationDays} days")
        );

        $stmt = $pdo->prepare("
            UPDATE subscriptions
            SET end_date = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$endDate, $activeSubscription['id']]);

        $subscriptionId = $activeSubscription['id'];

    } else {
        // Create new subscription
        $startDate = date('Y-m-d H:i:s');
        $endDate   = date('Y-m-d H:i:s', strtotime("+{$durationDays} days"));

        $stmt = $pdo->prepare("
            INSERT INTO subscriptions (
                product_id,
                plan_name,
                start_date,
                end_date,
                status,
                amount_paid,
                created_at
            ) VALUES (?, ?, ?, ?, 'active', ?, NOW())
        ");
        $stmt->execute([
            $productId,
            $planName,
            $startDate,
            $endDate,
            $transaction['amount']
        ]);

        $subscriptionId = $pdo->lastInsertId();
    }

    $pdo->commit();

    /**
     * --------------------------------------------------
     * RESPONSE
     * --------------------------------------------------
     */
    $daysRemaining = ceil((strtotime($endDate) - time()) / 86400);

    jsonResponse(true, 'Payment verified and subscription updated', [
        'subscription' => [
            'id' => $subscriptionId,
            'product_id' => $productId,
            'plan_name' => $planName,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'days_remaining' => $daysRemaining
        ],
        'payment' => [
            'reference' => $reference,
            'amount' => $transaction['amount'],
            'currency' => $transaction['currency'],
            'paid_at' => $transaction['paid_at']
        ]
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    jsonResponse(false, 'Database error');
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(false, 'Unexpected server error');
}
