USE zoo;

-- Recreate the trigger safely if it already exists.
DELIMITER $$

DROP TRIGGER IF EXISTS sponsorship_coupon_after_donation$$

-- After a qualifying sponsorship donation is inserted, automatically create
-- one unused 15% coupon for the donor.
CREATE TRIGGER sponsorship_coupon_after_donation
AFTER INSERT ON DONATION
FOR EACH ROW
BEGIN
    IF NEW.purpose = 'Sponsor an Animal'
       AND NEW.amount >= 150
       AND NEW.animal_ID IS NOT NULL
    THEN
        INSERT INTO COUPON (donor_email, code, discount_percent, is_used)
        SELECT d.donor_email,
               CONCAT('SPONSOR-DONATION-', NEW.donation_ID),
               15,
               FALSE
        FROM DONOR d
        WHERE d.donor_ID = NEW.donor_ID;
    END IF;
END$$

DELIMITER ;

-- Show the complete SQL definition of the trigger.
SHOW CREATE TRIGGER sponsorship_coupon_after_donation;

-- Show trigger name, timing, event, and table.
SHOW TRIGGERS LIKE 'sponsorship_coupon_after_donation';
