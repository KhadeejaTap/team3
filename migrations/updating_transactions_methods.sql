USE ZOO;

-- Remove the old payment method constraint
ALTER TABLE CUST_TRANSACTION
DROP CHECK CUST_TRANSACTION_chk_1;

-- Convert the existing online transaction
UPDATE CUST_TRANSACTION
SET payment_method = 'digital_wallet'
WHERE payment_method = 'online';

-- Add the new allowed payment methods
ALTER TABLE CUST_TRANSACTION
ADD CONSTRAINT CUST_TRANSACTION_chk_1
CHECK (
    payment_method IN (
        'credit',
        'debit',
        'digital_wallet',
        'paypal'
    )
);
