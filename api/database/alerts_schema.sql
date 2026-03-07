-- Drowning Alerts Table
CREATE TABLE IF NOT EXISTS drowning_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    alert_type ENUM('drowning', 'device_offline', 'low_battery') DEFAULT 'drowning',
    message TEXT,
    status ENUM('active', 'acknowledged', 'expired') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME NULL,
    INDEX idx_product_status (product_id, status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
