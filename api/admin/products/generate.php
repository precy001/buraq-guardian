<?php
/**
 * Generate New Product ID Endpoint
 * POST /api/admin/products/generate.php
 * 
 * Generates a unique Buraq device Product ID
 * Format: BRQ-{YEAR}-{RANDOM_ALPHANUMERIC}
 */

require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../middleware/admin_auth.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    jsonResponse(false, "Method not allowed");
}

// Rate limiting check (simple implementation)
session_start();
$rateLimitKey = 'product_gen_' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$currentTime = time();
$rateLimit = 10; // Max 10 generations per minute
$rateLimitWindow = 60; // 1 minute window

if (!isset($_SESSION[$rateLimitKey])) {
    $_SESSION[$rateLimitKey] = ['count' => 0, 'start' => $currentTime];
}

if ($currentTime - $_SESSION[$rateLimitKey]['start'] > $rateLimitWindow) {
    $_SESSION[$rateLimitKey] = ['count' => 0, 'start' => $currentTime];
}

if ($_SESSION[$rateLimitKey]['count'] >= $rateLimit) {
    http_response_code(429);
    jsonResponse(false, "Rate limit exceeded. Please wait before generating more Product IDs.");
}

try {
    // Validate admin authentication
    $admin = validateAdminToken();
    
    // Parse optional input (e.g., quantity to generate)
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $quantity = min(max((int)($input['quantity'] ?? 1), 1), 100); // Max 100 at a time
    
    $generatedProducts = [];
    $maxAttempts = 10; // Max attempts per product ID to avoid infinite loops
    
    $pdo->beginTransaction();
    
    for ($i = 0; $i < $quantity; $i++) {
        $productId = null;
        $attempts = 0;
        
        // Generate unique Product ID with collision check
        do {
            $productId = generateProductId();
            $attempts++;
            
            // Check if Product ID already exists
            $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM products WHERE product_id = :product_id");
            $stmt->execute(['product_id' => $productId]);
            $exists = $stmt->fetch()['count'] > 0;
            
            if ($attempts >= $maxAttempts && $exists) {
                $pdo->rollBack();
                http_response_code(500);
                jsonResponse(false, "Failed to generate unique Product ID after multiple attempts");
            }
            
        } while ($exists);
        
        // Insert new product
        $stmt = $pdo->prepare("
            INSERT INTO products (product_id, is_registered, created_at)
            VALUES (:product_id, 0, NOW())
        ");
        $stmt->execute(['product_id' => $productId]);
        
        $generatedProducts[] = [
            'product_id' => $productId,
            'is_registered' => false,
            'created_at' => date('Y-m-d H:i:s')
        ];
    }
    
    // Log admin action
    $stmt = $pdo->prepare("
        INSERT INTO admin_activity_log (admin_id, action, details, ip_address)
        VALUES (:admin_id, 'generate_product_ids', :details, :ip_address)
    ");
    $stmt->execute([
        'admin_id' => $admin['admin_id'],
        'details' => json_encode([
            'quantity' => $quantity,
            'product_ids' => array_column($generatedProducts, 'product_id')
        ]),
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null
    ]);
    
    $pdo->commit();
    
    // Increment rate limit counter
    $_SESSION[$rateLimitKey]['count'] += $quantity;
    
    // Return response
    if ($quantity === 1) {
        jsonResponse(true, "Product ID generated successfully", $generatedProducts[0]);
    } else {
        jsonResponse(true, "{$quantity} Product IDs generated successfully", [
            'count' => $quantity,
            'products' => $generatedProducts
        ]);
    }
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    jsonResponse(false, "Database error occurred");
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    jsonResponse(false, "An unexpected error occurred");
}

/**
 * Generate a Product ID in format: BRQ-{YEAR}-{RANDOM}
 * Random section is 6 uppercase alphanumeric characters
 */
function generateProductId() {
    $year = date('Y');
    $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $randomPart = '';
    
    // Generate 6 random alphanumeric characters
    for ($i = 0; $i < 6; $i++) {
        $randomPart .= $characters[random_int(0, strlen($characters) - 1)];
    }
    
    return "BRQ-{$year}-{$randomPart}";
}
