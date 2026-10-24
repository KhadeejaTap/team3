-- 1. Departments
INSERT INTO DEPARTMENT (department_ID, department_name, department_description) VALUES
(1, 'HR', 'Manages the hiring and treatment of employees'),
(2, 'Animal Care', 'Feeds, monitors, and looks after the health of zoo animals'),
(3, 'Veterinary', 'Provides medical care and treatment for animals'),
(4, 'Maintenance', 'Maintains enclosures, grounds, and facilities'),
(5, 'Security', 'Keeps visitors, staff, and animals safe');

-- 2. Department Leads / Managers (manager_ID is NULL because they are top-level heads)
INSERT INTO EMPLOYEE
(employee_ID, manager_ID, first_name, minit, last_name, street_address, city, state, zip_code, country, email, phone_number, department_ID, role, salary, hire_date, `current`, hours) VALUES
(1, NULL, 'Taylor', NULL, 'Hemsworth', '45 River St',   'Houston', 'TX', '77012', 'USA', 'taylor.hemsworth@zoo.com', '713-555-0106', 1, 'HR Director',          68000, '2019-05-22', 1, 40),
(2, NULL, 'Dwayne', NULL, 'Efron',     '300 Lake Rd',   'Houston', 'TX', '77013', 'USA', 'dwayne.efron@zoo.com',     '713-555-0107', 2, 'Mammal Lead Keeper',   58000, '2018-08-09', 1, 40),
(3, NULL, 'Morgan', NULL, 'Lawrence',  '9 Aspen Pl',    'Houston', 'TX', '77009', 'USA', 'morgan.lawrence@zoo.com',  '713-555-0114', 3, 'Chief Veterinarian',   98000, '2021-10-11', 1, 40),
(4, NULL, 'Ben',    NULL, 'Reynolds',  '77 Alder St',   'Houston', 'TX', '77016', 'USA', 'ben.reynolds@zoo.com',     '713-555-0110', 4, 'Grounds & Maint Lead', 55000, '2018-06-25', 1, 40),
(5, NULL, 'Arnold', NULL, 'Gosling',   '63 Walnut Dr',  'Houston', 'TX', '77017', 'USA', 'arnold.gosling@zoo.com',   '713-555-0119', 5, 'Security Chief',       52000, '2019-09-16', 1, 40);

-- 3. Set Department Heads in DEPARTMENT table
UPDATE DEPARTMENT SET head_employee_ID = 1 WHERE department_ID = 1;
UPDATE DEPARTMENT SET head_employee_ID = 2 WHERE department_ID = 2;
UPDATE DEPARTMENT SET head_employee_ID = 3 WHERE department_ID = 3;
UPDATE DEPARTMENT SET head_employee_ID = 4 WHERE department_ID = 4;
UPDATE DEPARTMENT SET head_employee_ID = 5 WHERE department_ID = 5;

-- 4. Staff Employees (reporting to their department leads)
INSERT INTO EMPLOYEE
(employee_ID, manager_ID, first_name, minit, last_name, street_address, city, state, zip_code, country, email, phone_number, department_ID, role, salary, hire_date, `current`, hours) VALUES
(6,  1, 'Jim',    NULL, 'Cruise',    '33 Birch Rd',   'Houston', 'TX', '77006', 'USA', 'jim.cruise@zoo.com',     '713-555-0111', 1, 'HR Assistant',       48000, '2021-05-03', 1, 40),
(7,  2, 'Ariana', NULL, 'Winslet',   '12 Fern Ct',    'Houston', 'TX', '77014', 'USA', 'ariana.winslet@zoo.com',   '713-555-0108', 2, 'Bird & Reptile Lead', 54000, '2019-02-11', 1, 40),
(8,  2, 'Justin', NULL, 'Perry',     '19 Willow St',  'Houston', 'TX', '77007', 'USA', 'justin.perry@zoo.com',   '713-555-0112', 2, 'Keeper',             45000, '2020-08-17', 1, 40),
(9,  2, 'Katy',   NULL, 'Hart',      '67 Spruce Way', 'Houston', 'TX', '77008', 'USA', 'katy.hart@zoo.com',      '713-555-0113', 2, 'Keeper',             44000, '2022-02-21', 1, 35),
(10, 3, 'Justin', NULL, 'Damon',     '90 Linden Ave', 'Houston', 'TX', '77015', 'USA', 'justin.damon@zoo.com',     '713-555-0109', 3, 'Senior Vet Tech',    60000, '2017-04-03', 1, 40),
(11, 3, 'Ellen',  NULL, 'Rogan',     '21 Cypress Ln', 'Houston', 'TX', '77018', 'USA', 'ellen.rogan@zoo.com',    '713-555-0120', 3, 'Veterinary Tech',    46000, '2022-01-10', 1, 40),
(12, 4, 'Ryan',   NULL, 'Sandler',   '151 Ash Blvd',  'Houston', 'TX', '77010', 'USA', 'ryan.sandler@zoo.com',   '713-555-0115', 4, 'Technician',         42000, '2023-04-05', 1, 40),
(13, 5, 'Chuck',  NULL, 'Statham',   '28 Poplar St',  'Houston', 'TX', '77011', 'USA', 'chuck.statham@zoo.com',  '713-555-0116', 5, 'Security Guard',     39000, '2022-07-18', 0, 30);

-- 5. Employment History (including current status, past termination, and a rehire example)
INSERT INTO EMPLOYMENT_HISTORY (employee_ID, department_ID, role, salary, start_date, end_date, status) VALUES
(1,  1, 'HR Director',          68000, '2019-05-22', NULL,         'active'),
(2,  2, 'Mammal Lead Keeper',   58000, '2018-08-09', NULL,         'active'),
(3,  3, 'Chief Veterinarian',   98000, '2021-10-11', NULL,         'active'),
(4,  4, 'Grounds & Maint Lead', 55000, '2018-06-25', NULL,         'active'),
(5,  5, 'Security Chief',       52000, '2019-09-16', NULL,         'active'),
(6,  1, 'HR Assistant',         48000, '2021-05-03', NULL,         'active'),
(7,  2, 'Bird & Reptile Lead',  54000, '2019-02-11', NULL,         'active'),
(8,  2, 'Keeper',               45000, '2020-08-17', NULL,         'active'),
-- Katy Hart Rehire Example: stint 1 (terminated) + stint 2 (current active)
(9,  2, 'Junior Apprentice',    35000, '2019-06-01', '2021-08-15', 'terminated'),
(9,  2, 'Keeper',               44000, '2022-02-21', NULL,         'active'),
(10, 3, 'Senior Vet Tech',      60000, '2017-04-03', NULL,         'active'),
(11, 3, 'Veterinary Tech',      46000, '2022-01-10', NULL,         'active'),
(12, 4, 'Technician',           42000, '2023-04-05', NULL,         'active'),
-- Chuck Statham: Terminated security guard (current = 0)
(13, 5, 'Security Guard',       39000, '2022-07-18', '2023-11-30', 'terminated');

-- 6. Attractions
INSERT INTO ATTRACTION (attr_ID, name, type, location, attr_datetime, capacity, description) VALUES
(1, 'Safari Train Tour',       'Tour',       'South Trail',     '2026-10-24', 40, 'Guided tram tour through the African savanna exhibit'),
(2, 'Reptile Encounter',        'Exhibit',    'Reptile House',   '2026-10-24', 25, 'Hands-on presentation with snakes and lizards'),
(3, 'Penguin Feeding Show',     'Live Show',  'Aquatic Pavilion','2026-10-24', 60, 'Daily live feeding and trainer Q&A session'),
(4, 'Petting Zoo',              'Interactive','Children Farm',   '2026-10-24', 30, 'Feed and interact with goats, sheep, and llamas'),
(5, 'Aviary Walkthrough',       'Exhibit',    'Bird Sanctuary',  '2026-10-24', 35, 'Walk-in aviary featuring exotic tropical birds');

-- 7. Staffed At (Many-to-Many employee to attraction assignments)
INSERT INTO STAFFED_AT (employee_ID, attr_ID) VALUES
(7, 2), -- Ariana Winslet -> Reptile Encounter
(7, 5), -- Ariana Winslet -> Aviary Walkthrough
(8, 1), -- Justin Perry -> Safari Train Tour
(9, 1), -- Katy Hart -> Safari Train Tour
(9, 4), -- Katy Hart -> Petting Zoo
(10, 3), -- Justin Damon -> Penguin Feeding Show
(12, 1); -- Ryan Sandler -> Safari Train Tour

-- 8. Login Credentials in users table
INSERT INTO users (email, password, role) VALUES
('admin@zoo.com',        'admin123',    'admin'),
('dwayne.efron@zoo.com', 'manager123',  'manager'),
('katy.hart@zoo.com',    'employee123', 'employee'),
('visitor@zoo.com',      'visitor123',  'visitor');

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
  CONCAT_WS(' ', e.first_name, e.last_name) AS name,
  CONCAT_WS(', ', e.street_address, e.city, e.state, e.zip_code, e.country) AS address,
  e.email, e.phone_number,
  e.role, e.salary, e.hire_date, e.hours,
  CASE WHEN e.`current` = 1 THEN 'current' ELSE 'past' END AS employment_status
  FROM EMPLOYEE AS e
  LEFT JOIN DEPARTMENT as d ON e.department_ID = d.department_ID
  LEFT JOIN EMPLOYEE as h ON e.manager_ID = h.employee_ID;
