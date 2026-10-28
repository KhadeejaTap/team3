CREATE OR REPLACE VIEW visitor_membership_view AS
SELECT
  v.visitor_ID,
  v.name,
  v.age,
  v.date_of_birth,
  v.email,
  v.phone,
  EXISTS (
    SELECT 1
    FROM MEMBERSHIP AS m
    WHERE m.visitor_ID = v.visitor_ID
      AND CURRENT_TIMESTAMP >= m.start_date
      AND CURRENT_TIMESTAMP < m.expiration_date
  ) AS has_active_membership
FROM VISITOR AS v;
