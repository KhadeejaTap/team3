CREATE OR REPLACE VIEW attraction_view AS
  SELECT a.attr_ID, a.name, a.type, a.location, a.attr_datetime,
  a.capacity, a.description,
  COALESCE(
    GROUP_CONCAT(
      DISTINCT CONCAT_WS(' ', e.first_name, e.last_name)
      ORDER BY e.last_name, e.first_name
      SEPARATOR ', '
    ),
    'Unassigned'
  ) AS assigned_staff
  FROM ATTRACTION AS a
  LEFT JOIN STAFFED_AT AS sa ON a.attr_ID = sa.attr_ID
  LEFT JOIN EMPLOYEE AS e ON sa.employee_ID = e.employee_ID
  GROUP BY a.attr_ID, a.name, a.type, a.location, a.attr_datetime,
  a.capacity, a.description;

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