
USE zoo;

CREATE TABLE IF NOT EXISTS low_stock_alert (
    alert_ID INT AUTO_INCREMENT PRIMARY KEY,
    product_ID INT NOT NULL,
    stock_at_alert INT NOT NULL,
    status ENUM('unaddressed', 'order placed', 'dismissed') NOT NULL DEFAULT 'unaddressed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_ID) REFERENCES product(product_ID) ON DELETE CASCADE
);

DELIMITER //

DROP TRIGGER IF EXISTS product_purchase_stock_insert//
CREATE TRIGGER product_purchase_stock_insert
BEFORE INSERT ON transaction_item
FOR EACH ROW
BEGIN
    IF NEW.item_type = 'product' THEN
        IF NEW.transaction_ID IS NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Product purchase requires a transaction';
        END IF;

        IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Purchase quantity must be positive';
        END IF;

        UPDATE product
        SET quantity_in_stock = quantity_in_stock - NEW.quantity
        WHERE product_ID = NEW.item_ID
          AND quantity_in_stock >= NEW.quantity;

        IF ROW_COUNT() = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Product unavailable or insufficient stock';
        END IF;
    END IF;
END//

CREATE TRIGGER trg_low_stock_alert
AFTER UPDATE ON product
FOR EACH ROW
BEGIN
    IF NEW.quantity_in_stock <= COALESCE(NEW.reorder_level, 5)
       AND OLD.quantity_in_stock > COALESCE(OLD.reorder_level, 5) THEN
        INSERT INTO low_stock_alert (product_ID, stock_at_alert, status)
        VALUES (NEW.product_ID, NEW.quantity_in_stock, 'unaddressed');
    END IF;

    IF NEW.quantity_in_stock > COALESCE(NEW.reorder_level, 5) THEN
        UPDATE low_stock_alert
        SET status = 'dismissed'
        WHERE product_ID = NEW.product_ID
          AND status != 'dismissed';
    END IF;
END//

DELIMITER ;
