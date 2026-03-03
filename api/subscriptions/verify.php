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
$paystackSecretKey = getenv('PAYSTACK_SECRET_KEY');
if (!$paystackSecretKey) {
    http_response_code(500);
    jsonResponse(false, 'Payment configuration error');
}

/**
 * --------------------------------------------------
 * WEBHOOK SIGNATURE VERIFICATION
 * --------------------------------------------------
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $paystackSignature = $_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '';
    $rawBody           = file_get_contents('php://input');
    $computedSignature = hash_hmac('sha512', $rawBody, $paystackSecretKey);

    if (!hash_equals($computedSignature, $paystackSignature)) {
        http_response_code(401);
        jsonResponse(false, 'Invalid webhook signature');
    }
}

/**
 * --------------------------------------------------
 * GET PAYMENT REFERENCE
 * --------------------------------------------------
 */
$reference = $_GET['reference'] ?? null;

if (!$reference && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input     = json_decode(file_get_contents('php://input'), true);
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

/**
 * --------------------------------------------------
 * PLAN DEFINITIONS (server-side, never trust client)
 * --------------------------------------------------
 */
$plans = [
    'basic'   => ['duration_days' => 30],
    'premium' => ['duration_days' => 30],
    'annual'  => ['duration_days' => 365],
];

try {

    /**
     * --------------------------------------------------
     * VERIFY WITH PAYSTACK FIRST
     * --------------------------------------------------
     */
    $ch = curl_init('https://api.paystack.co/transaction/verify/' . urlencode($reference));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $paystackSecretKey,
            'Content-Type: application/json'
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT        => 30
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
    $metadata  = $transaction['metadata'] ?? [];
    $productId = $metadata['product_id'] ?? null;
    $planName  = $metadata['plan_name']  ?? null;

    if (!$productId || !$planName) {
        http_response_code(400);
        jsonResponse(false, 'Invalid payment metadata');
    }

    // Look up duration server-side, never trust client value
    if (!isset($plans[$planName])) {
        http_response_code(400);
        jsonResponse(false, 'Invalid plan name in metadata');
    }
    $durationDays = $plans[$planName]['duration_days'];

    /**
     * --------------------------------------------------
     * VERIFY PRODUCT EXISTS (correct table)
     * --------------------------------------------------
     */
    $stmt = $pdo->prepare("SELECT id FROM products WHERE product_id = ? AND is_registered = 1");
    $stmt->execute([$productId]);

    if (!$stmt->fetch()) {
        http_response_code(404);
        jsonResponse(false, 'Product not found or not registered');
    }

    /**
     * --------------------------------------------------
     * ATOMIC DATABASE TRANSACTION
     * --------------------------------------------------
     */
    $pdo->beginTransaction();

    /**
     * 1. RECORD PAYMENT
     *    UNIQUE constraint on payment_reference handles idempotency.
     *    If already inserted, it throws a PDOException we catch below.
     */
    try {
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
    } catch (PDOException $e) {
        // Duplicate reference — already processed
        $pdo->rollBack();
        jsonResponse(true, 'Payment already processed', [
            'already_processed' => true
        ]);
    }

    /**
     * 2. STACK SUBSCRIPTION
     *    Check both active AND suspended so we extend either correctly.
     */
    $stmt = $pdo->prepare("
        SELECT id, start_date, end_date, status
        FROM subscriptions
        WHERE product_id = ? 
        AND status IN ('active', 'suspended')
        AND end_date > NOW()
        ORDER BY end_date DESC
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$productId]);
    $existingSubscription = $stmt->fetch();

    if ($existingSubscription) {
        // Extend existing subscription from its current end date
        $startDate = $existingSubscription['start_date'];
        $endDate   = date(
            'Y-m-d H:i:s',
            strtotime($existingSubscription['end_date'] . " +{$durationDays} days")
        );

        $stmt = $pdo->prepare("
            UPDATE subscriptions
            SET end_date = ?, status = 'active', updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$endDate, $existingSubscription['id']]);

        $subscriptionId = $existingSubscription['id'];

    } else {
        // No active or suspended subscription — create a new one
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
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, 'active', ?, NOW(), NOW())
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
    $daysRemaining = (int) ceil((strtotime($endDate) - time()) / 86400);

    jsonResponse(true, 'Payment verified and subscription updated', [
        'subscription' => [
            'id'            => $subscriptionId,
            'product_id'    => $productId,
            'plan_name'     => $planName,
            'start_date'    => $startDate,
            'end_date'      => $endDate,
            'days_remaining'=> $daysRemaining
        ],
        'payment' => [
            'reference' => $reference,
            'amount'    => $transaction['amount'] / 100, // Convert kobo to naira
            'currency'  => $transaction['currency'],
            'paid_at'   => $transaction['paid_at']
        ]
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Verification PDO error: ' . $e->getMessage());
    http_response_code(500);
    jsonResponse(false, 'Database error');
} catch (Exception $e) {
    error_log('Verification error: ' . $e->getMessage());
    http_response_code(500);
    jsonResponse(false, 'Unexpected server error');
}