-- migration_028: Advance order number sequence to start at BBJ-1232
-- Any future order number will be BBJ-1232 or higher.
-- setval(seq, 1231, true) means the *next* call to nextval() returns 1232.

SELECT setval('public.order_number_seq', 1231, true);
