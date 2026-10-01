CREATE TABLE DEPARTMENT(
	department_ID INT AUTO_INCREMENT PRIMARY KEY, -- fk to employee and enclosure
	department_name varchar(50) UNIQUE,
	department_description varchar(500)
);
