CREATE TABLE EMPLOYEE(
	employee_ID INT AUTO_INCREMENT PRIMARY KEY,
	manager_ID INT,
	name varchar(30),
	street_address varchar(50),
	city varchar(30),
	state varchar(20),
	zip_code varchar(10),
	country varchar(50),
	email varchar(50),
	phone_number varchar(20),
	department_ID INT, -- fk to department
	role varchar(50), -- vet, general manager, trainer, ect
	salary INT,
	hire_date DATE, -- YYYY-MM-DD
	current BOOL,
	hours INT
);
