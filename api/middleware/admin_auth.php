<?php
/**
 * Admin Authentication Middleware
 * Validates admin session token for all admin-only endpoints
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';

function validateAdminToken() {
    global $pdo;
    
    // Get Authorization header
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
    
    if (!$authHeader || !preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
        http_response_code(401);
        jsonResponse(false, "Unauthorized: Missing or invalid authorization header");
    }
    
    $token = $matches[1];
    
    try {
        // Validate token against admin_sessions table
       $stmt = $pdo->prepare("
        SELECT sess.*, a.id as admin_id, a.username, a.email, a.full_name
        FROM admin_sessions sess
        JOIN admins a ON sess.admin_id = a.id
        WHERE sess.token = :token 
        AND sess.expires_at > NOW()
        AND a.is_active = 1
    ");
        $stmt->execute(['token' => $token]);
        $session = $stmt->fetch();
        
        if (!$session) {
            http_response_code(401);
            jsonResponse(false, "Unauthorized: Invalid or expired token");
        }
        
        // Return admin data for use in endpoints
        return [
            'admin_id' => $session['admin_id'],
            'username' => $session['username'],
            'email' => $session['email'],
            'full_name' => $session['full_name']
        ];
        
    } catch (PDOException $e) {
        http_response_code(500);
        jsonResponse(false, "Authentication error");
    }
}

function generateSecureToken($length = 64) {
    return bin2hex(random_bytes($length / 2));
}
