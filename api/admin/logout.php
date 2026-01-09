<?php
/**
 * Admin Logout Endpoint
 * POST /api/admin/logout.php
 * 
 * Invalidates admin session token
 */

require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/admin_auth.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    jsonResponse(false, "Method not allowed");
}

try {
    // Get Authorization header
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
    
    if ($authHeader && preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $token = $matches[1];
        
        // Get admin ID before deleting session
        $stmt = $pdo->prepare("
            SELECT admin_id FROM admin_sessions WHERE token = :token
        ");
        $stmt->execute(['token' => $token]);
        $session = $stmt->fetch();
        
        // Delete the session
        $stmt = $pdo->prepare("DELETE FROM admin_sessions WHERE token = :token");
        $stmt->execute(['token' => $token]);
        
        // Log logout
        if ($session) {
            $stmt = $pdo->prepare("
                INSERT INTO admin_activity_log (admin_id, action, details, ip_address)
                VALUES (:admin_id, 'logout', :details, :ip_address)
            ");
            $stmt->execute([
                'admin_id' => $session['admin_id'],
                'details' => json_encode(['action' => 'manual_logout']),
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null
            ]);
        }
    }
    
    jsonResponse(true, "Logged out successfully");
    
} catch (PDOException $e) {
    http_response_code(500);
    jsonResponse(false, "Database error occurred");
}
