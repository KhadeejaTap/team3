CREATE OR REPLACE VIEW visitor_membership_view AS
SELECT
  v.visitor_ID,
  v.name,
  v.age,
  v.date_of_birth,
  v.email,
  v.phone,
  v.membership AS has_active_membership
FROM VISITOR AS v;
