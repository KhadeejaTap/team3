CREATE TABLE EMPLOYEE (
  employee_ID INT PRIMARY KEY,
  employee_type VARCHAR(50),
  name VARCHAR(100),
  address VARCHAR(150),
  email VARCHAR(100),
  phone_number VARCHAR(20),
  position VARCHAR(50),
  salary DECIMAL(10, 2),
  hire_date DATE,
  department_ID INT NOT NULL,
  manager_ID INT,
  hours DECIMAL(5, 2),

  FOREIGN KEY (department_ID) REFERENCES DEPARTMENT(department_ID),
  FOREIGN KEY (manager_ID) REFERENCES EMPLOYEE(employee_ID)
);