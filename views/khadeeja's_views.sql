-- 1. Departments
INSERT INTO DEPARTMENT (department_ID, department_name, department_description) VALUES
(1, 'HR', 'Manages the hiring and treatment of employees'),
(2, 'Animal Care', 'Feeds, monitors, and looks after the health of zoo animals'),
(3, 'Veterinary', 'Provides medical care and treatment for animals'),
(6, 'Retail', 'Manages zoo gift shops, merchandise sales, and visitor souvenirs'),
(7, 'Food Services', 'Operates dining stalls, snack kiosks, and food concessions'),
(8, 'Parking', 'Oversees guest parking lots, traffic flow, and parking toll booths'),
(9, 'Events & Attractions', 'Coordinates guest experiences, educational presentations, and operates zoo attractions and tours');

-- 2. Department Leads
INSERT INTO EMPLOYEE
(employee_ID, manager_ID, first_name, minit, last_name, street_address, city, state, zip_code, country, email, phone_number, department_ID, role, salary, hire_date, `current`, hours) VALUES
(1, NULL, 'Taylor', NULL, 'Hemsworth', '45 River St',   'Houston', 'TX', '77012', 'USA', 'taylor.hemsworth@zoo.com', '713-555-0106', 1, 'HR Director',          68000, '2019-05-22', 1, 40),
(2, NULL, 'Dwayne', NULL, 'Efron',     '300 Lake Rd',   'Houston', 'TX', '77013', 'USA', 'dwayne.efron@zoo.com',     '713-555-0107', 2, 'Mammal Lead Keeper',   58000, '2018-08-09', 1, 40),
(3, NULL, 'Morgan', NULL, 'Lawrence',  '9 Aspen Pl',    'Houston', 'TX', '77009', 'USA', 'morgan.lawrence@zoo.com',  '713-555-0114', 3, 'Chief Veterinarian',   98000, '2021-10-11', 1, 40),
(21, NULL, 'Emma',  NULL, 'Watson',    '101 Market St', 'Houston', 'TX', '77002', 'USA', 'emma.watson@zoo.com',     '713-555-0128', 6, 'Retail Manager',       48000, '2021-08-15', 1, 40),
(23, NULL, 'Gordon',NULL, 'Ramsay',    '77 Culinary Bl', 'Houston','TX', '77004', 'USA', 'gordon.ramsay@zoo.com',   '713-555-0130', 7, 'Food Services Director', 56000, '2020-03-10', 1, 40),
(25, NULL, 'Vin',   NULL, 'Diesel',    '99 Speedway Ln','Houston', 'TX', '77019', 'USA', 'vin.diesel@zoo.com',       '713-555-0132', 8, 'Parking Operations Lead', 45000, '2019-11-20', 1, 40),
(27, NULL, 'Rachel',NULL, 'Green',     '909 Broadway Ave','Houston','TX', '77002', 'USA', 'rachel.green@zoo.com',    '713-555-0127', 9, 'Events & Attractions Director', 68000, '2020-08-15', 1, 40);

-- 3. Set Department Heads
UPDATE DEPARTMENT SET head_employee_ID = 1 WHERE department_ID = 1;
UPDATE DEPARTMENT SET head_employee_ID = 2 WHERE department_ID = 2;
UPDATE DEPARTMENT SET head_employee_ID = 3 WHERE department_ID = 3;
UPDATE DEPARTMENT SET head_employee_ID = 21 WHERE department_ID = 6;
UPDATE DEPARTMENT SET head_employee_ID = 23 WHERE department_ID = 7;
UPDATE DEPARTMENT SET head_employee_ID = 25 WHERE department_ID = 8;
UPDATE DEPARTMENT SET head_employee_ID = 27 WHERE department_ID = 9;

-- 4. Staff Employees
INSERT INTO EMPLOYEE
(employee_ID, manager_ID, first_name, minit, last_name, street_address, city, state, zip_code, country, email, phone_number, department_ID, role, salary, hire_date, `current`, hours) VALUES
(6,  1, 'Jim',    NULL, 'Cruise',    '33 Birch Rd',   'Houston', 'TX', '77006', 'USA', 'jim.cruise@zoo.com',     '713-555-0111', 1, 'HR Assistant',       48000, '2021-05-03', 1, 40),
(7,  2, 'Ariana', NULL, 'Winslet',   '12 Fern Ct',    'Houston', 'TX', '77014', 'USA', 'ariana.winslet@zoo.com',   '713-555-0108', 2, 'Bird & Reptile Lead', 54000, '2019-02-11', 1, 40),
(8,  2, 'Justin', NULL, 'Perry',     '19 Willow St',  'Houston', 'TX', '77007', 'USA', 'justin.perry@zoo.com',   '713-555-0112', 2, 'Keeper',             45000, '2020-08-17', 1, 40),
(9,  2, 'Katy',   NULL, 'Hart',      '67 Spruce Way', 'Houston', 'TX', '77008', 'USA', 'katy.hart@zoo.com',      '713-555-0113', 2, 'Keeper',             44000, '2022-02-21', 1, 35),
(10, 3, 'Justin', NULL, 'Damon',     '90 Linden Ave', 'Houston', 'TX', '77015', 'USA', 'justin.damon@zoo.com',     '713-555-0109', 3, 'Senior Vet Tech',    60000, '2017-04-03', 1, 40),
(11, 3, 'Ellen',  NULL, 'Rogan',     '21 Cypress Ln', 'Houston', 'TX', '77018', 'USA', 'ellen.rogan@zoo.com',    '713-555-0120', 3, 'Veterinary Tech',    46000, '2022-01-10', 1, 40),
(14, 1, 'Sarah',  NULL, 'Connor',    '18 Oak Ridge',  'Houston', 'TX', '77024', 'USA', 'sarah.connor@zoo.com',    '713-555-0121', 1, 'Benefits Coordinator', 46000, '2022-03-15', 1, 40),
(15, 2, 'Leo',    NULL, 'DiCaprio',  '88 Marine Dr',  'Houston', 'TX', '77025', 'USA', 'leo.dicaprio@zoo.com',    '713-555-0122', 2, 'Aquatics Specialist', 47000, '2021-06-14', 1, 40),
(16, 3, 'Chloe',  NULL, 'Bennett',   '41 Blossom Ct', 'Houston', 'TX', '77027', 'USA', 'chloe.bennett@zoo.com',   '713-555-0123', 3, 'Vet Assistant',       38000, '2023-01-09', 1, 35),
(22, 21, 'Tom',   NULL, 'Hardy',     '44 Bazaar Ave', 'Houston', 'TX', '77003', 'USA', 'tom.hardy@zoo.com',       '713-555-0129', 6, 'Gift Shop Associate',   32000, '2022-10-01', 1, 30),
(24, 23, 'Mia',   NULL, 'Goth',      '12 Kitchen Way','Houston', 'TX', '77005', 'USA', 'mia.goth@zoo.com',         '713-555-0131', 7, 'Food Stall Attendant',  31000, '2023-02-14', 1, 30),
(26, 25, 'Paul',  NULL, 'Walker',    '180 Transit Dr','Houston', 'TX', '77020', 'USA', 'paul.walker@zoo.com',      '713-555-0133', 8, 'Parking Lot Attendant', 33000, '2022-05-18', 1, 35),
(28, 27, 'Chris', NULL, 'Pratt',     '912 Parkside Dr','Houston','TX', '77004', 'USA', 'chris.pratt@zoo.com',      '713-555-0128', 9, 'Safari Tram Operator & Guide', 38000, '2023-03-20', 1, 40),
(29, 27, 'Zendaya',NULL,'Coleman',   '915 Meadow Ln', 'Houston', 'TX', '77005', 'USA', 'zendaya.coleman@zoo.com',  '713-555-0129', 9, 'Live Presentation & Show Host', 42000, '2022-07-11', 1, 40);

-- 5. Employment History
INSERT INTO EMPLOYMENT_HISTORY (employee_ID, department_ID, role, salary, start_date, end_date, status) VALUES
(1,  1, 'HR Director',          68000, '2019-05-22', NULL,         'active'),
(2,  2, 'Mammal Lead Keeper',   58000, '2018-08-09', NULL,         'active'),
(3,  3, 'Chief Veterinarian',   98000, '2021-10-11', NULL,         'active'),
(6,  1, 'HR Assistant',         48000, '2021-05-03', NULL,         'active'),
(7,  2, 'Bird & Reptile Lead',  54000, '2019-02-11', NULL,         'active'),
(8,  2, 'Keeper',               45000, '2020-08-17', NULL,         'active'),
(9,  2, 'Junior Apprentice',    35000, '2019-06-01', '2021-08-15', 'terminated'),
(9,  2, 'Keeper',               44000, '2022-02-21', NULL,         'active'),
(10, 3, 'Senior Vet Tech',      60000, '2017-04-03', NULL,         'active'),
(11, 3, 'Veterinary Tech',      46000, '2022-01-10', NULL,         'active'),
(14, 1, 'Benefits Coordinator', 46000, '2022-03-15', NULL,         'active'),
(15, 2, 'Aquatics Specialist',  47000, '2021-06-14', NULL,         'active'),
(16, 3, 'Vet Assistant',        38000, '2023-01-09', NULL,         'active'),
(21, 6, 'Retail Manager',       48000, '2021-08-15', NULL,         'active'),
(22, 6, 'Gift Shop Associate',  32000, '2022-10-01', NULL,         'active'),
(23, 7, 'Food Services Director', 56000, '2020-03-10', NULL,       'active'),
(24, 7, 'Food Stall Attendant', 31000, '2023-02-14', NULL,         'active'),
(25, 8, 'Parking Operations Lead', 45000, '2019-11-20', NULL,      'active'),
(26, 8, 'Parking Lot Attendant',33000, '2022-05-18', NULL,         'active'),
(27, 9, 'Events & Attractions Director', 68000, '2020-08-15', NULL,'active'),
(28, 9, 'Safari Tram Operator & Guide',  38000, '2023-03-20', NULL,'active'),
(29, 9, 'Live Presentation & Show Host', 42000, '2022-07-11', NULL,'active');

-- 6. Attractions
INSERT INTO ATTRACTION (attr_ID, name, type, location, attr_datetime, capacity, description) VALUES
(1, 'Safari Train Tour',       'Tour',       'South Trail',     '2026-10-24', 40, 'Guided tram tour through the African savanna exhibit'),
(2, 'Reptile Encounter',        'Exhibit',    'Reptile House',   '2026-10-24', 25, 'Hands-on presentation with snakes and lizards'),
(3, 'Penguin Feeding Show',     'Live Show',  'Aquatic Pavilion','2026-10-24', 60, 'Daily live feeding and trainer Q&A session'),
(4, 'Petting Zoo',              'Interactive','Children Farm',   '2026-10-24', 30, 'Feed and interact with goats, sheep, and llamas'),
(5, 'Aviary Walkthrough',       'Exhibit',    'Bird Sanctuary',  '2026-10-24', 35, 'Walk-in aviary featuring exotic tropical birds');

-- 7. Staffed At
INSERT INTO STAFFED_AT (employee_ID, attr_ID) VALUES
(28, 1),
(8, 1),
(9, 1),
(7, 2),
(29, 3),
(15, 3),
(29, 4),
(9, 4),
(7, 5),
(8, 5);

-- 8. Users
INSERT INTO users (email, password, role) VALUES
('admin@zoo.com',        'admin123',    'admin'),
('dwayne.efron@zoo.com', 'dwayne123',   'manager'),
('katy.hart@zoo.com',    'katy123',     'employee'),
('visitor@zoo.com',      'visitor123',  'visitor'),
('morgan.lawrence@zoo.com', 'morgan123', 'manager'),
('ariana.winslet@zoo.com',  'ariana123', 'employee'),
('taylor.hemsworth@zoo.com', 'taylor123', 'manager'),
('emma.watson@zoo.com',      'emma123',   'manager'),
('gordon.ramsay@zoo.com',    'gordon123', 'manager'),
('vin.diesel@zoo.com',       'vin123',    'manager'),
('rachel.green@zoo.com',     'rachel123', 'manager'),
('jim.cruise@zoo.com',       'jim123',    'employee'),
('justin.perry@zoo.com',     'justin123', 'employee'),
('justin.damon@zoo.com',     'justin123', 'employee'),
('ellen.rogan@zoo.com',      'ellen123',  'employee'),
('sarah.connor@zoo.com',     'sarah123',  'employee'),
('leo.dicaprio@zoo.com',     'leo123',    'employee'),
('chloe.bennett@zoo.com',    'chloe123',  'employee'),
('tom.hardy@zoo.com',        'tom123',    'employee'),
('mia.goth@zoo.com',         'mia123',    'employee'),
('paul.walker@zoo.com',      'paul123',   'employee'),
('chris.pratt@zoo.com',      'chris123',  'employee'),
('zendaya.coleman@zoo.com',  'zendaya123','employee');

-- 9. Views
CREATE OR REPLACE VIEW guest_view AS
SELECT department_name, department_description
FROM DEPARTMENT;

CREATE OR REPLACE VIEW employee_directory AS
  SELECT e.employee_ID, CONCAT_WS(' ', e.first_name, e.last_name) AS name, e.email, e.phone_number, d.department_name, e.role
  FROM EMPLOYEE AS e
  JOIN DEPARTMENT AS d ON e.department_ID = d.department_ID
  WHERE e.`current` = 1;

CREATE OR REPLACE VIEW manager_view AS
  SELECT e.manager_ID, e.employee_ID, e.department_ID,
  CONCAT_WS(' ', h.first_name, h.last_name) AS head_of_dept,
  d.department_name,
  CONCAT_WS(' ', e.first_name, e.last_name) AS name,
  CONCAT_WS(', ', e.street_address, e.city, e.state, e.zip_code, e.country) AS address,
  e.email, e.phone_number,
  e.role, e.salary, e.hire_date, e.hours,
  COALESCE(GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', '), 'Unassigned') AS attractions
  FROM EMPLOYEE AS e
  JOIN DEPARTMENT as d ON e.department_ID = d.department_ID
  LEFT JOIN EMPLOYEE AS h ON h.employee_ID = d.head_employee_ID
  LEFT JOIN STAFFED_AT AS sa ON e.employee_ID = sa.employee_ID
  LEFT JOIN ATTRACTION AS a ON sa.attr_ID = a.attr_ID
  WHERE e.`current` = 1
  GROUP BY e.employee_ID, e.manager_ID, e.department_ID, h.first_name, h.last_name, d.department_name, e.first_name, e.last_name, e.street_address, e.city, e.state, e.zip_code, e.country, e.email, e.phone_number, e.role, e.salary, e.hire_date, e.hours;

CREATE OR REPLACE VIEW admin_view AS
  SELECT e.manager_ID,
  CONCAT_WS(' ', h.first_name, h.last_name) AS manager_name,
  e.employee_ID, e.department_ID, d.department_name,
  e.first_name, e.minit, e.last_name,
  CONCAT_WS(' ', e.first_name, e.last_name) AS name,
  e.street_address, e.city, e.state, e.zip_code, e.country,
  CONCAT_WS(', ', e.street_address, e.city, e.state, e.zip_code, e.country) AS address,
  e.email, e.phone_number,
  e.role, e.salary, e.hire_date, e.hours,
  CASE WHEN e.`current` = 1 THEN 'current' ELSE 'past' END AS employment_status
  FROM EMPLOYEE AS e
  LEFT JOIN DEPARTMENT as d ON e.department_ID = d.department_ID
  LEFT JOIN EMPLOYEE as h ON e.manager_ID = h.employee_ID;

-- 10. Triggers
DELIMITER $$

DROP TRIGGER IF EXISTS trg_staffed_at_qualification_check$$
CREATE TRIGGER trg_staffed_at_qualification_check
BEFORE INSERT ON STAFFED_AT
FOR EACH ROW
BEGIN
    DECLARE emp_dept INT;
    SELECT department_ID INTO emp_dept FROM EMPLOYEE WHERE employee_ID = NEW.employee_ID;

    IF emp_dept NOT IN (2, 9) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Business Rule Violation: Only Events & Attractions and Animal Care staff are authorized to staff zoo attractions.';
    END IF;
END$$

DROP TRIGGER IF EXISTS trg_staffed_at_qualification_update$$
CREATE TRIGGER trg_staffed_at_qualification_update
BEFORE UPDATE ON STAFFED_AT
FOR EACH ROW
BEGIN
    DECLARE emp_dept INT;
    SELECT department_ID INTO emp_dept FROM EMPLOYEE WHERE employee_ID = NEW.employee_ID;

    IF emp_dept NOT IN (2, 9) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Business Rule Violation: Only Events & Attractions and Animal Care staff are authorized to staff zoo attractions.';
    END IF;
END$$

DELIMITER ;
