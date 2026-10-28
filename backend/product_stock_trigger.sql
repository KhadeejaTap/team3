-- Run against the intended zoo database.
-- Already installed on Azure; this file records its definition.
-- Requires InnoDB tables.
-- Stock is deducted when a product transaction item is inserted.
-- The checkout backend must not deduct stock separately.

USE zoo;

DELIMITER //

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

DELIMITER ;