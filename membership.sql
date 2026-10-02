CREATE TABLE MEMBERSHIP(
	membership_ID INT AUTO_INCREMENT PRIMARY KEY,
	visitor_ID INT, -- fk to visitor TABLE
	membership_type varchar(30),
	start_date DATETIME NOT NULL,
	expiration_date DATETIME NOT NULL,
	CHECK (expiration_date > start_date)
	-- no membership_status. we can compute frm the dates
);
