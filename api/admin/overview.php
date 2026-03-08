<?php
/**
 * Admin Dashboard Overview Endpoint
 * GET /api/admin/overview.php
 * 
 * Returns platform statistics and recent activity
 */

require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../middleware/admin_auth.php';

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    jsonResponse(false, "Method not allowed");
}

try {
    // Validate admin authentication
    $admin = validateAdminToken();
    
    // Get total products count
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM products");
    $totalProducts = $stmt->fetch()['total'];
    
    // Get registered products count
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM products WHERE is_registered = 1");
    $registeredProducts = $stmt->fetch()['total'];
    
    // Get unregistered products count
    $unregisteredProducts = $totalProducts - $registeredProducts;
    
    // Get active subscriptions count
    $stmt = $pdo->query("
        SELECT COUNT(*) as total FROM subscriptions 
        WHERE status = 'active' AND end_date > NOW()
    ");
    $activeSubscriptions = $stmt->fetch()['total'];
    
    // Get expired subscriptions count
    $stmt = $pdo->query("
        SELECT COUNT(*) as total FROM subscriptions 
        WHERE status = 'expired' OR (status = 'active' AND end_date <= NOW())
    ");
    $expiredSubscriptions = $stmt->fetch()['total'];
    
    // Get suspended subscriptions count
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM subscriptions WHERE status = 'suspended'");
    $suspendedSubscriptions = $stmt->fetch()['total'];
    
    // Get total users count
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM users");
    $totalUsers = $stmt->fetch()['total'];
    
    // Get recently generated product IDs (last 10)
    $stmt = $pdo->query("
        SELECT product_id, is_registered, created_at 
        FROM products 
        ORDER BY created_at DESC 
        LIMIT 10
    ");
    $recentProducts = $stmt->fetchAll();
    
    // Get recent subscriptions (last 10)
    $stmt = $pdo->query("
        SELECT s.*, u.full_name, u.product_id
        FROM subscriptions s
        LEFT JOIN users u ON s.product_id = u.product_id
        ORDER BY s.created_at DESC
        LIMIT 10
    ");
    $recentSubscriptions = $stmt->fetchAll();
    
    // Get recent admin activity (last 10) - optional if table exists
    $recentActivity = [];
    $activityTable = $pdo->query("SHOW TABLES LIKE 'admin_activity_log'")->fetch();
    if ($activityTable) {
        $stmt = $pdo->query("
            SELECT al.*, a.username
            FROM admin_activity_log al
            JOIN admins a ON al.admin_id = a.id
            ORDER BY al.created_at DESC
            LIMIT 10
        ");
        $recentActivity = $stmt->fetchAll();
    }
    
    // Calculate revenue (this month)
    $stmt = $pdo->query("
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM subscriptions 
        WHERE status = 'active' 
        AND MONTH(created_at) = MONTH(NOW()) 
        AND YEAR(created_at) = YEAR(NOW())
    ");
    $monthlyRevenue = $stmt->fetch()['total'];
    
    jsonResponse(true, "Dashboard data retrieved", [
        'statistics' => [
            'products' => [
                'total' => (int)$totalProducts,
                'registered' => (int)$registeredProducts,
                'unregistered' => (int)$unregisteredProducts
            ],
            'subscriptions' => [
                'active' => (int)$activeSubscriptions,
                'expired' => (int)$expiredSubscriptions,
                'suspended' => (int)$suspendedSubscriptions
            ],
            'users' => [
                'total' => (int)$totalUsers
            ],
            'revenue' => [
                'this_month' => (float)$monthlyRevenue
            ]
        ],
        'recent_products' => $recentProducts,
        'recent_subscriptions' => $recentSubscriptions,
        'recent_activity' => $recentActivity
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    jsonResponse(false, "Database error occurred");
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(false, "An unexpected error occurred");
}
