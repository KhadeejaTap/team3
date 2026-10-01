
-- many to many
CREATE TABLE STAFFED_AT(
	employee_ID INT,
	attr_ID INT,
	PRIMARY KEY (employee_ID, attr_ID),
	FOREIGN KEY (employee_ID) REFERENCES EMPLOYEE(employee_ID),
	FOREIGN KEY (attr_ID) REFERENCES ATTRACTION(attr_ID)
);
