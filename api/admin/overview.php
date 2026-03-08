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
    
    $pdo = getDBConnection();
    
    // Helper to safely run a count query
    function safeCount($pdo, $query) {
        try {
            $stmt = $pdo->query($query);
            return (int)$stmt->fetch()['total'];
        } catch (Exception $e) {
            error_log("Dashboard query failed: " . $e->getMessage() . " | Query: " . $query);
            return 0;
        }
    }
    
    $totalProducts = safeCount($pdo, "SELECT COUNT(*) as total FROM products");
    $registeredProducts = safeCount($pdo, "SELECT COUNT(*) as total FROM products WHERE is_registered = 1");
    $unregisteredProducts = $totalProducts - $registeredProducts;
    
    $activeSubscriptions = safeCount($pdo, "SELECT COUNT(*) as total FROM subscriptions WHERE status = 'active' AND end_date > NOW()");
    $expiredSubscriptions = safeCount($pdo, "SELECT COUNT(*) as total FROM subscriptions WHERE status = 'expired' OR (status = 'active' AND end_date <= NOW())");
    $suspendedSubscriptions = safeCount($pdo, "SELECT COUNT(*) as total FROM subscriptions WHERE status = 'suspended'");
    
    $totalUsers = safeCount($pdo, "SELECT COUNT(*) as total FROM users");
    
    // Revenue - subscriptions table uses amount_paid column
    $monthlyRevenue = 0;
    try {
        $stmt = $pdo->query("
            SELECT COALESCE(SUM(amount_paid), 0) as total 
            FROM subscriptions 
            WHERE status = 'active' 
            AND MONTH(created_at) = MONTH(NOW()) 
            AND YEAR(created_at) = YEAR(NOW())
        ");
        $monthlyRevenue = (float)$stmt->fetch()['total'];
    } catch (Exception $e) {
        error_log("Revenue query failed: " . $e->getMessage());
    }
    
    // Recent products
    $recentProducts = [];
    try {
        $stmt = $pdo->query("SELECT product_id, is_registered, created_at FROM products ORDER BY created_at DESC LIMIT 10");
        $recentProducts = $stmt->fetchAll();
    } catch (Exception $e) {}
    
    // Recent subscriptions
    $recentSubscriptions = [];
    try {
        $stmt = $pdo->query("
            SELECT s.*, u.full_name, u.product_id as user_product_id
            FROM subscriptions s
            LEFT JOIN users u ON s.product_id = u.product_id
            ORDER BY s.created_at DESC
            LIMIT 10
        ");
        $recentSubscriptions = $stmt->fetchAll();
    } catch (Exception $e) {}
    
    // Recent admin activity - optional
    $recentActivity = [];
    try {
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
    } catch (Exception $e) {}
    
    jsonResponse(true, "Dashboard data retrieved", [
        'statistics' => [
            'products' => [
                'total' => $totalProducts,
                'registered' => $registeredProducts,
                'unregistered' => $unregisteredProducts
            ],
            'subscriptions' => [
                'active' => $activeSubscriptions,
                'expired' => $expiredSubscriptions,
                'suspended' => $suspendedSubscriptions
            ],
            'users' => [
                'total' => $totalUsers
            ],
            'revenue' => [
                'this_month' => $monthlyRevenue
            ]
        ],
        'recent_products' => $recentProducts,
        'recent_subscriptions' => $recentSubscriptions,
        'recent_activity' => $recentActivity
    ]);
    
} catch (Exception $e) {
    error_log("Admin overview error: " . $e->getMessage());
    http_response_code(500);
    jsonResponse(false, "Database error occurred: " . $e->getMessage());
}
