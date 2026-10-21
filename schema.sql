DROP DATABASE IF EXISTS ZOO;
CREATE DATABASE ZOO;
USE ZOO;
-- ANIMAL RELATIONSHIP TABLE
CREATE TABLE ANIMAL_CARE (
  animal_ID INT,
  employee_ID INT,
  PRIMARY KEY (animal_ID, employee_ID)

);

CREATE TABLE ANIMAL (
  animal_ID INT AUTO_INCREMENT PRIMARY KEY,
  species_ID INT NOT NULL,
  enclosure_ID INT NOT NULL,
  name VARCHAR(100),
  age INT,
  gender VARCHAR(20),
  weight DECIMAL (6, 2),
  arrival_date DATE,
  breeding_status VARCHAR(50)

);

CREATE TABLE ATTRACTION (
    attr_ID INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(30),
    location VARCHAR(40),
    attr_datetime DATE,
    capacity INT,
    description VARCHAR(500)
    -- removed extra comma
);

CREATE TABLE ATTR_ANIMAL(
    attr_animal_ID INT AUTO_INCREMENT PRIMARY KEY,
    animal_ID INT NOT NULL,
    attr_ID INT NOT NULL

    -- FOREIGN KEY (animal_ID) REFERENCES ANIMAL (animal_ID),
    -- FOREIGN KEY (attr_ID) REFERENCES ATTRACTION (attr_ID)
);

CREATE TABLE ATTR_TICKET(
    attr_ticket_ID INT AUTO_INCREMENT PRIMARY KEY,
    ticket_ID INT NOT NULL, -- does this need a pk
    attr_ID INT NOT NULL

    -- FOREIGN KEY (ticket_ID) REFERENCES TICKET (ticket_ID),
    -- FOREIGN KEY (attr_ID) REFERENCES ATTRACTION (attr_ID)
);

-- I changed transaction to cust_transaction bc "transaction" is a reserved keyword in SQL
CREATE TABLE CUST_TRANSACTION (
    transaction_ID  INT AUTO_INCREMENT PRIMARY KEY, -- AUTO_INCREMENT provides unique number
    visitor_ID  INT, -- this will be a foreign key referencing the VISITOR table
    total  DECIMAL(10,2),
    transaction_date  DATE,
    payment_method  VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'credit', 'debit', 'online'))
);
CREATE TABLE DEPARTMENT(
	department_ID INT AUTO_INCREMENT PRIMARY KEY, -- fk to employee and enclosure
	department_name varchar(50) UNIQUE NOT NULL,
	department_description varchar(500)
);

CREATE TABLE DONATION (
    donation_ID  INT AUTO_INCREMENT PRIMARY KEY,
    donor_ID  INT NOT NULL, -- this will be a foreign key referencing the VISITOR table
    amount  DECIMAL(10,2) NOT NULL CHECK(amount >= 0),
    donation_date  DATE NOT NULL,
    purpose VARCHAR(225) NOT NULL
);
CREATE TABLE donor (
    donor_ID  INT AUTO_INCREMENT PRIMARY KEY,
    donor_name  VARCHAR(100) NOT NULL,
    donor_email  VARCHAR(100) NOT NULL,
    donor_phone  VARCHAR(20) NOT NULL
);
CREATE TABLE EMPLOYEE(
	employee_ID INT AUTO_INCREMENT PRIMARY KEY,
	manager_ID INT,
	first_name varchar(30) NOT NULL,
	minit varchar(1),
	last_name varchar(30) NOT NULL,
	street_address varchar(50) NOT NULL,
	city varchar(30) NOT NULL,
	state varchar(20) NOT NULL,
	zip_code varchar(10) NOT NULL,
	country varchar(50) NOT NULL,
	email varchar(50) NOT NULL UNIQUE,
	phone_number varchar(20),
	department_ID INT, -- fk to department
	role varchar(50), -- vet, general manager, trainer, ect
	salary INT NOT NULL,
	hire_date DATE NOT NULL, -- YYYY-MM-DD
	current BOOL NOT NULL,
	hours INT
);

CREATE TABLE ENCLOSURE (
  enclosure_ID INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  location VARCHAR(100),
  capacity INT,
  indoor_outdoor VARCHAR(20),
  size INT,
  department_ID INT NOT NULL -- fk to managing dept in dept table

);

CREATE TABLE FEEDING (
  feeding_ID INT AUTO_INCREMENT PRIMARY KEY,
  amount INT,
  animal_ID INT,
  feeding_time TIME,
  food_ID INT,
  employee_ID INT

);

CREATE TABLE FEED_ITEM (
  food_ID INT AUTO_INCREMENT PRIMARY KEY,
  food_name VARCHAR(100),
  food_category VARCHAR(50),
  supplier VARCHAR(50),
  quantity INT
);

CREATE TABLE FOOD_STALL (
stall_ID INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  location VARCHAR(100),
  opening_time TIME,
  closing_time TIME,
  department_ID INT NOT NULL

  -- FOREIGN KEY (department_ID) REFERENCES DEPARTMENT(department_ID)
);

CREATE TABLE GIFT_SHOP (
shop_ID INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  location VARCHAR(100),
  department_ID INT NOT NULL

  -- FOREIGN KEY (department_ID) REFERENCES DEPARTMENT(department_ID)
);

CREATE TABLE MEDICAL_RECORD (
  record_ID INT AUTO_INCREMENT PRIMARY KEY,
  animal_ID INT,
  date DATE,
  diagnosis VARCHAR(255),
  treatment VARCHAR(255),
  notes VARCHAR(255),
  vet_ID INT,
  follow_up DATE

);

CREATE TABLE MEMBERSHIP(
	membership_ID INT AUTO_INCREMENT PRIMARY KEY,
	visitor_ID INT, -- fk to visitor TABLE
	membership_type varchar(30),
	start_date DATETIME NOT NULL,
	expiration_date DATETIME NOT NULL,
	CHECK (expiration_date > start_date)
	-- no membership_status. we can compute frm the dates
);

CREATE TABLE MENU_ITEM (
item_ID INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  price DECIMAL(8, 2),
  category VARCHAR(50),
  stall_ID INT NOT NULL

  -- FOREIGN KEY (stall_ID) REFERENCES FOOD_STALL(stall_ID)
);

CREATE TABLE PARKING_LOT (
lot_ID INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  location VARCHAR(100),
  capacity INT,
  parking_rate DECIMAL(8, 2),
  department_ID INT NOT NULL

  -- FOREIGN KEY (department_ID) REFERENCES DEPARTMENT(department_ID)
);

CREATE TABLE PARKING_SESSION (
session_ID INT AUTO_INCREMENT PRIMARY KEY,
  lot_ID INT NOT NULL,
  license_plate VARCHAR(20),
  entry_time DATETIME,
  exit_time DATETIME

  -- FOREIGN KEY (lot_ID) REFERENCES PARKING_LOT(lot_ID)
);

CREATE TABLE PRODUCT (
product_ID INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  category VARCHAR(50),
  price DECIMAL(8, 2),
  quantity_in_stock INT,
  color VARCHAR(50),
  design VARCHAR(100),
  shop_ID INT NOT NULL

  -- FOREIGN KEY (shop_ID) REFERENCES GIFT_SHOP(shop_ID)
);

CREATE TABLE SPECIES (
  species_ID INT AUTO_INCREMENT PRIMARY KEY,
  common_name VARCHAR(100),
  scientific_name VARCHAR(100),
  endangered_status VARCHAR(50)
);


CREATE TABLE TICKET(
    ticket_ID INT AUTO_INCREMENT PRIMARY KEY,
    visitor_ID INT,
    ticket_type VARCHAR(30),
    price INT,
    purchase_date DATE,
    visit_date DATE
    -- removed extra comma
);

CREATE TABLE TRANSACTION_ITEM (
    transaction_item_ID  INT AUTO_INCREMENT PRIMARY KEY,
    transaction_ID  INT, -- this will be a FK referencing the CUST_TRANSACTION table
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('food', 'product', 'ticket', 'parking', 'donation')),
    item_ID  INT NOT NULL,
    quantity   INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price  DECIMAL(10,2) NOT NULL CHECK(price >= 0)
);

CREATE TABLE users (
	userID INT AUTO_INCREMENT PRIMARY KEY,
	username VARCHAR(50) UNIQUE NOT NULL,
	email VARCHAR(100) UNIQUE NOT NULL,
	password VARCHAR(255) NOT NULL,
	role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'employee', 'visitor'))
);

CREATE TABLE VISITOR(
    visitor_ID INT AUTO_INCREMENT PRIMARY KEY, -- does this imply each visitor has only purchased one ticket? what abt repeat visitors
    name VARCHAR(100),
    age INT,
    date_of_birth date,
    email  VARCHAR(100),
    phone  VARCHAR(20),
    membership BOOLEAN DEFAULT FALSE
    -- FOREIGN KEY(ticket_ID) REFERENCES TICKET(ticket_ID)
);


-- many to many
CREATE TABLE STAFFED_AT(
	employee_ID INT,
	attr_ID INT,
	PRIMARY KEY (employee_ID, attr_ID),
	FOREIGN KEY (employee_ID) REFERENCES EMPLOYEE(employee_ID),
	FOREIGN KEY (attr_ID) REFERENCES ATTRACTION(attr_ID)
);

-- i noted the files i copied from
-- commenting out unmade tables
-- from animal.sql
ALTER TABLE ANIMAL
	ADD FOREIGN KEY (species_ID) REFERENCES SPECIES(species_ID),
	ADD FOREIGN KEY (enclosure_ID) REFERENCES ENCLOSURE(enclosure_ID);

-- from attraction.sql
ALTER TABLE ATTR_ANIMAL
	ADD FOREIGN KEY (animal_ID) REFERENCES ANIMAL (animal_ID),
    ADD FOREIGN KEY (attr_ID) REFERENCES ATTRACTION (attr_ID);

ALTER TABLE ATTR_TICKET
	ADD FOREIGN KEY (ticket_ID) REFERENCES TICKET (ticket_ID),
    ADD FOREIGN KEY (attr_ID) REFERENCES ATTRACTION (attr_ID);

-- feeding.sql
ALTER TABLE FEEDING
	ADD FOREIGN KEY (food_ID) REFERENCES FEED_ITEM (food_ID),
	ADD FOREIGN KEY (animal_ID) REFERENCES ANIMAL(animal_ID),
	ADD FOREIGN KEY (employee_ID) REFERENCES EMPLOYEE(employee_ID);

-- FOOD_STALL.sql
ALTER TABLE FOOD_STALL ADD FOREIGN KEY (department_ID) REFERENCES DEPARTMENT(department_ID);

-- GIFT_SHOP.sql
ALTER TABLE GIFT_SHOP ADD FOREIGN KEY (department_ID) REFERENCES DEPARTMENT(department_ID);

-- medical_records.sql
ALTER TABLE MEDICAL_RECORD
	ADD FOREIGN KEY(animal_ID) REFERENCES ANIMAL(animal_ID),
	ADD FOREIGN KEY (vet_ID) REFERENCES EMPLOYEE(employee_ID);

-- menu_item.SQL
ALTER TABLE MENU_ITEM ADD FOREIGN KEY (stall_ID) REFERENCES FOOD_STALL(stall_ID);

-- PARKING_LOT.SQL
alter table PARKING_LOT add FOREIGN KEY (department_ID) REFERENCES DEPARTMENT(department_ID);
-- parking_sessions.SQL
ALTER TABLE PARKING_SESSION ADD FOREIGN KEY (lot_ID) REFERENCES PARKING_LOT(lot_ID);

-- PRODUCT.SQL
ALTER TABLE PRODUCT ADD FOREIGN KEY (shop_ID) REFERENCES GIFT_SHOP(shop_ID);

-- enclosure.SQL managed by what dept relation
ALTER TABLE ENCLOSURE ADD FOREIGN KEY (department_ID) REFERENCES DEPARTMENT(department_ID);

-- under what dept relation
ALTER TABLE EMPLOYEE
	ADD FOREIGN KEY (department_ID) REFERENCES DEPARTMENT(department_ID),
	ADD FOREIGN KEY (manager_ID) REFERENCES EMPLOYEE(employee_ID) ON DELETE SET NULL;

-- from animal care
ALTER TABLE ANIMAL_CARE
	ADD FOREIGN KEY (animal_ID) REFERENCES ANIMAL(animal_ID) ON DELETE CASCADE,
	ADD FOREIGN KEY (employee_ID) REFERENCES EMPLOYEE(employee_ID) ON DELETE CASCADE;

-- CUST_TRANSACTION.SQL
ALTER TABLE CUST_TRANSACTION ADD FOREIGN KEY (visitor_ID) REFERENCES VISITOR(visitor_ID) ON DELETE RESTRICT;

-- TRANSACTION_ITEM.SQL
ALTER TABLE TRANSACTION_ITEM ADD FOREIGN KEY (transaction_ID) REFERENCES CUST_TRANSACTION(transaction_ID) ON DELETE CASCADE;

-- DONATION.SQL
ALTER TABLE DONATION
	ADD FOREIGN KEY (donor_ID) REFERENCES donor(donor_ID) ON DELETE RESTRICT;

-- frm membership.SQL
ALTER TABLE MEMBERSHIP
	ADD FOREIGN KEY (visitor_ID) REFERENCES VISITOR(visitor_ID) ON DELETE CASCADE;

-- using an fk so we dont enforce vistors to only have one id
ALTER TABLE TICKET
	ADD FOREIGN KEY (visitor_ID) REFERENCES VISITOR(visitor_ID);

ALTER TABLE DEPARTMENT
	ADD COLUMN head_employee_ID INT NULL,
	ADD FOREIGN KEY (head_employee_ID) REFERENCES EMPLOYEE(employee_ID);
