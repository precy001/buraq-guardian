<?php
/**
 * Admin Login Endpoint
 * POST /api/admin/login.php
 * 
 * Authenticates admin credentials and returns session token
 */

require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    jsonResponse(false, "Method not allowed");
}

try {
    // Parse JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        jsonResponse(false, "Invalid JSON payload");
    }
    
    // Validate required fields
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';
    
    if (empty($username) || empty($password)) {
        http_response_code(400);
        jsonResponse(false, "Username and password are required");
    }
    
    // Find admin by username or email
    $stmt = $pdo->prepare("
        SELECT id, username, email, full_name, password_hash, is_active
        FROM admins
        WHERE (username = :username OR email = :username)
        LIMIT 1
    ");
    $stmt->execute(['username' => $username]);
    $admin = $stmt->fetch();
    
    // Verify credentials
    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        http_response_code(401);
        jsonResponse(false, "Invalid credentials");
    }
    
    // Check if admin is active
    if (!$admin['is_active']) {
        http_response_code(403);
        jsonResponse(false, "Account is deactivated");
    }
    
    // Generate session token
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
    
    // Store session
    $stmt = $pdo->prepare("
        INSERT INTO admin_sessions (admin_id, token, expires_at, ip_address, user_agent)
        VALUES (:admin_id, :token, :expires_at, :ip_address, :user_agent)
    ");
    $stmt->execute([
        'admin_id' => $admin['id'],
        'token' => $token,
        'expires_at' => $expiresAt,
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
    ]);
    
    // Log admin login
    $stmt = $pdo->prepare("
        INSERT INTO admin_activity_log (admin_id, action, details, ip_address)
        VALUES (:admin_id, 'login', :details, :ip_address)
    ");
    $stmt->execute([
        'admin_id' => $admin['id'],
        'details' => json_encode(['username' => $admin['username']]),
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null
    ]);
    
    // Return success with token
    jsonResponse(true, "Login successful", [
        'token' => $token,
        'expires_at' => $expiresAt,
        'admin' => [
            'id' => $admin['id'],
            'username' => $admin['username'],
            'email' => $admin['email'],
            'full_name' => $admin['full_name']
        ]
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    jsonResponse(false, "Database error occurred");
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(false, "An unexpected error occurred");
}
