-- migration_066: Rename product color "purple" → "lavender"
-- Updates the color text[] array on all products that contain "purple",
-- replacing it with "lavender" to match the renamed filter value.

UPDATE products
SET color = array_replace(color, 'purple', 'lavender')
WHERE 'purple' = ANY(color);
