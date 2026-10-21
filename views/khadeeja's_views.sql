INSERT INTO DEPARTMENT (department_name, department_description) VALUES
('HR', 'Manages the hiring and treatment of employees'),
('Animal Care', 'Feeds, monitors, and looks after the health of zoo animals'),
('Veterinary', 'Provides medical care and treatment for animals'),
('Maintenance', 'Maintains enclosures, grounds, and facilities'),
('Security', 'Keeps visitors, staff, and animals safe');

INSERT INTO EMPLOYEE
(manager_ID, first_name, minit, last_name, street_address, city, state, zip_code, country, email, phone_number, department_ID, role, salary, hire_date, `current`, hours) VALUES
(1, 'Taylor', NULL, 'Hemsworth', '45 River St',   'Houston', 'TX', '77012', 'USA', 'taylor.hemsworth@zoo.com', '713-555-0106', 1, 'HR Specialist',       58000, '2019-05-22', 1, 40),
(2, 'Dwayne', NULL, 'Efron',     '300 Lake Rd',   'Houston', 'TX', '77013', 'USA', 'dwayne.efron@zoo.com',     '713-555-0107', 2, 'Mammal Lead Keeper',  55000, '2018-08-09', 1, 40),
(2, 'Ariana', NULL, 'Winslet',   '12 Fern Ct',    'Houston', 'TX', '77014', 'USA', 'ariana.winslet@zoo.com',   '713-555-0108', 2, 'Bird & Reptile Lead', 54000, '2019-02-11', 1, 40),
(3, 'Justin', NULL, 'Damon',     '90 Linden Ave', 'Houston', 'TX', '77015', 'USA', 'justin.damon@zoo.com',     '713-555-0109', 3, 'Senior Vet Tech',     60000, '2017-04-03', 1, 40),
(3, 'Morgan', NULL, 'Lawrence',  '9 Aspen Pl',    'Houston', 'TX', '77009', 'USA', 'morgan.lawrence@zoo.com',  '713-555-0114', 3, 'Staff Veterinarian',  95000, '2021-10-11', 1, 40),
(4, 'Ben',    NULL, 'Reynolds',  '77 Alder St',   'Houston', 'TX', '77016', 'USA', 'ben.reynolds@zoo.com',     '713-555-0110', 4, 'Grounds Lead',        52000, '2018-06-25', 1, 40),
(5, 'Arnold', NULL, 'Gosling',   '63 Walnut Dr',  'Houston', 'TX', '77017', 'USA', 'arnold.gosling@zoo.com',   '713-555-0119', 5, 'Shift Supervisor',    50000, '2019-09-16', 1, 40);

INSERT INTO EMPLOYEE
(manager_ID, first_name, minit, last_name, street_address, city, state, zip_code, country, email, phone_number, department_ID, role, salary, hire_date, `current`, hours) VALUES
(6,  'Jim',    NULL, 'Cruise',    '33 Birch Rd',   'Houston', 'TX', '77006', 'USA', 'jim.cruise@zoo.com',     '713-555-0111', 1, 'HR Assistant',    48000, '2021-05-03', 1, 40),
(7,  'Justin', NULL, 'Perry',     '19 Willow St',  'Houston', 'TX', '77007', 'USA', 'justin.perry@zoo.com',   '713-555-0112', 2, 'Keeper',          45000, '2020-08-17', 1, 40),
(8,  'Katy',   NULL, 'Hart',      '67 Spruce Way', 'Houston', 'TX', '77008', 'USA', 'katy.hart@zoo.com',      '713-555-0113', 2, 'Keeper',          44000, '2022-02-21', 1, 35),
(9,  'Ellen',  NULL, 'Rogan',     '21 Cypress Ln', 'Houston', 'TX', '77018', 'USA', 'ellen.rogan@zoo.com',    '713-555-0120', 3, 'Veterinary Tech', 46000, '2022-01-10', 1, 40),
(11, 'Ryan',   NULL, 'Sandler',   '151 Ash Blvd',  'Houston', 'TX', '77010', 'USA', 'ryan.sandler@zoo.com',   '713-555-0115', 4, 'Technician',      42000, '2023-04-05', 1, 40),
(12, 'Chuck',  NULL, 'Statham',   '28 Poplar St',  'Houston', 'TX', '77011', 'USA', 'chuck.statham@zoo.com',  '713-555-0116', 5, 'Security Guard',  39000, '2022-07-18', 0, 30);

INSERT INTO users (username, email, password, role) VALUES
('admin_user',    'admin@zoo.com',        'admin123',    'admin'),
('manager_user',  'dwayne.efron@zoo.com', 'manager123',  'manager'),
('employee_user', 'katy.hart@zoo.com',    'employee123', 'employee'),
('visitor_user',  'visitor@zoo.com',      'visitor123',  'visitor');

CREATE VIEW guest_view AS
SELECT department_name, department_description
FROM DEPARTMENT;

CREATE VIEW employee_directory AS
  SELECT CONCAT_WS(' ', e.first_name, e.last_name) AS name, e.email, e.phone_number, d.department_name, e.role
  FROM EMPLOYEE AS e
  JOIN DEPARTMENT AS d ON e.department_ID = d.department_ID
  WHERE e.`current` = 1;

CREATE VIEW manager_view AS
  SELECT e.manager_ID, e.employee_ID, e.department_ID,
  CONCAT_WS(' ', h.first_name, h.last_name) AS head_of_dept,
  d.department_name,
  CONCAT_WS(' ', e.first_name, e.last_name) AS name,
  CONCAT_WS(', ', e.street_address, e.city, e.state, e.zip_code, e.country) AS address,
  e.email, e.phone_number,
  e.role, e.salary, e.hire_date, e.hours
  FROM EMPLOYEE AS e
  JOIN DEPARTMENT as d ON e.department_ID = d.department_ID
  LEFT JOIN EMPLOYEE AS h ON h.employee_ID = d.head_employee_ID
  WHERE e.`current` = 1;

-- fix with join also remember to input into staffed at
CREATE VIEW hr_view AS
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
