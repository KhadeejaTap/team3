-- I changed transaction to cust_transaction bc "transaction" is a reserved keyword in SQL
CREATE TABLE CUST_TRANSACTION (
    transaction_ID  INT AUTO_INCREMENT PRIMARY KEY, -- AUTO_INCREMENT provides unique number 
    visitor_ID  INT, -- this will be a foreign key referencing the VISITOR table
    total  DECIMAL(10,2), 
    transaction_date  DATE, 
    payment_method  VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'credit', 'debit', 'online'))
);