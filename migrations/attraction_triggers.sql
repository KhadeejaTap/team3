DELIMITER $$

CREATE TRIGGER attraction_capacity_before_insert
BEFORE INSERT ON ATTRACTION
FOR EACH ROW
BEGIN
  IF NEW.capacity < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Attraction capacity cannot be negative';
  END IF;
END$$

CREATE TRIGGER attraction_capacity_before_update
BEFORE UPDATE ON ATTRACTION
FOR EACH ROW
BEGIN
  IF NEW.capacity < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Attraction capacity cannot be negative';
  END IF;
END$$

DELIMITER ;