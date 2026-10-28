DELIMITER $$

CREATE TRIGGER membership_after_insert
AFTER INSERT ON MEMBERSHIP
FOR EACH ROW
BEGIN
  UPDATE VISITOR AS v
  SET membership = EXISTS (
    SELECT 1
    FROM MEMBERSHIP AS m
    WHERE m.visitor_ID = v.visitor_ID
      AND CURRENT_TIMESTAMP >= m.start_date
      AND CURRENT_TIMESTAMP < m.expiration_date
  )
  WHERE v.visitor_ID = NEW.visitor_ID;
END$$

CREATE TRIGGER membership_after_update
AFTER UPDATE ON MEMBERSHIP
FOR EACH ROW
BEGIN
  UPDATE VISITOR AS v
  SET membership = EXISTS (
    SELECT 1
    FROM MEMBERSHIP AS m
    WHERE m.visitor_ID = v.visitor_ID
      AND CURRENT_TIMESTAMP >= m.start_date
      AND CURRENT_TIMESTAMP < m.expiration_date
  )
  WHERE v.visitor_ID IN (OLD.visitor_ID, NEW.visitor_ID);
END$$

CREATE TRIGGER membership_after_delete
AFTER DELETE ON MEMBERSHIP
FOR EACH ROW
BEGIN
  UPDATE VISITOR AS v
  SET membership = EXISTS (
    SELECT 1
    FROM MEMBERSHIP AS m
    WHERE m.visitor_ID = v.visitor_ID
      AND CURRENT_TIMESTAMP >= m.start_date
      AND CURRENT_TIMESTAMP < m.expiration_date
  )
  WHERE v.visitor_ID = OLD.visitor_ID;
END$$

DELIMITER ;
