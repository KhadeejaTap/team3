USE ZOO;

-- added userID to donors for donations to be recorded or donated using guest account
ALTER TABLE donor
ADD COLUMN userID INT NULL,
ADD CONSTRAINT fk_donor_users
    FOREIGN KEY (userID)
    REFERENCES users(userID)
    ON DELETE SET NULL;

-- Validating that donation transcation items reference existing donations
DELIMITER $$

CREATE TRIGGER validate_donation_item_insert
BEFORE INSERT ON TRANSACTION_ITEM
FOR EACH ROW
BEGIN
    IF NEW.item_type = 'donation'
        AND NOT EXISTS (
            SELECT 1
            FROM DONATION
            WHERE donation_ID = NEW.item_ID
        )
    THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Donation does not exist';
    END IF;
END$$

CREATE TRIGGER validate_donation_item_update
BEFORE UPDATE ON TRANSACTION_ITEM
FOR EACH ROW
BEGIN
    IF NEW.item_type = 'donation'
        AND NOT EXISTS (
            SELECT 1
            FROM DONATION
            WHERE donation_ID = NEW.item_ID
        )
    THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Donation does not exist';
    END IF;
END$$

DELIMITER ;