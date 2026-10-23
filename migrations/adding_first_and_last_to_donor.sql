USE ZOO; 

DESCRIBE donor; 

-- Add the new name columns
ALTER TABLE donor
ADD COLUMN first_name VARCHAR(50) NULL,
ADD COLUMN last_name VARCHAR(50) NULL;

-- preserving existing donors and splitting their names to each respective fields 
UPDATE donor
SET
    first_name = SUBSTRING_INDEX(TRIM(donor_name), ' ', 1),
    last_name = CASE
        WHEN TRIM(donor_name) LIKE '% %'
        THEN TRIM(SUBSTRING(
            TRIM(donor_name),
            LOCATE(' ', TRIM(donor_name)) + 1
        ))
        ELSE ''
    END;

ALTER TABLE donor
MODIFY COLUMN first_name VARCHAR(50) NOT NULL,
MODIFY COLUMN last_name VARCHAR(50) NOT NULL;

-- Remove donor_name
ALTER TABLE donor
DROP COLUMN donor_name;


