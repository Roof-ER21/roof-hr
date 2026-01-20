-- ============================================================
-- INVENTORY UPDATE - January 19, 2026
-- Run this script against the production database via Railway
-- ============================================================

-- Step 1: Mark all existing inventory as inactive
UPDATE tool_inventory
SET is_active = false, updated_at = NOW()::text;

-- Step 2: Delete existing inventory to start fresh (optional - comment out to keep history)
-- DELETE FROM tool_inventory;

-- Step 3: Insert new inventory items
-- WOMEN'S SHIRTS - SHORT SLEEVE
INSERT INTO tool_inventory (id, name, category, description, serial_number, model, quantity, available_quantity, condition, size, purchase_date, purchase_price, location, notes, is_active, created_by, created_at, updated_at)
VALUES
  ('womens-ss-white-shirt-xs', 'Women''s SS White Shirt (Size XS)', 'POLO', 'Women''s short sleeve white shirt - Size XS', 'INV-CLOTHING-XS-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Women''s SS White Shirt', 2, 2, 'NEW', 'XS', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('womens-ss-white-shirt-s', 'Women''s SS White Shirt (Size S)', 'POLO', 'Women''s short sleeve white shirt - Size S', 'INV-CLOTHING-S-' || EXTRACT(EPOCH FROM NOW())::bigint || '1', 'Women''s SS White Shirt', 1, 1, 'NEW', 'S', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('womens-ss-black-shirt-s', 'Women''s SS Black Shirt (Size S)', 'POLO', 'Women''s short sleeve black shirt - Size S', 'INV-CLOTHING-S-' || EXTRACT(EPOCH FROM NOW())::bigint || '2', 'Women''s SS Black Shirt', 4, 4, 'NEW', 'S', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- WOMEN'S SHIRTS - LONG SLEEVE
  ('womens-ls-black-shirt-s', 'Women''s LS Black Shirt (Size S)', 'POLO', 'Women''s long sleeve black shirt - Size S', 'INV-CLOTHING-S-' || EXTRACT(EPOCH FROM NOW())::bigint || '3', 'Women''s LS Black Shirt', 4, 4, 'NEW', 'S', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('womens-ls-black-shirt-m', 'Women''s LS Black Shirt (Size M)', 'POLO', 'Women''s long sleeve black shirt - Size M', 'INV-CLOTHING-M-' || EXTRACT(EPOCH FROM NOW())::bigint || '1', 'Women''s LS Black Shirt', 3, 3, 'NEW', 'M', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- ROOF-ER SHIRTS - LONG SLEEVE GREY
  ('roof-er-ls-grey-shirt-m', 'Roof-ER LS Grey Shirt (Size M)', 'POLO', 'Roof-ER long sleeve grey shirt - Size M', 'INV-POLO-M-' || EXTRACT(EPOCH FROM NOW())::bigint || '1', 'Roof-ER LS Grey Shirt', 19, 19, 'NEW', 'M', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ls-grey-shirt-l', 'Roof-ER LS Grey Shirt (Size L)', 'POLO', 'Roof-ER long sleeve grey shirt - Size L', 'INV-POLO-L-' || EXTRACT(EPOCH FROM NOW())::bigint || '1', 'Roof-ER LS Grey Shirt', 29, 29, 'NEW', 'L', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ls-grey-shirt-xl', 'Roof-ER LS Grey Shirt (Size XL)', 'POLO', 'Roof-ER long sleeve grey shirt - Size XL', 'INV-POLO-XL-' || EXTRACT(EPOCH FROM NOW())::bigint || '1', 'Roof-ER LS Grey Shirt', 22, 22, 'NEW', 'XL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ls-grey-shirt-xxl', 'Roof-ER LS Grey Shirt (Size XXL)', 'POLO', 'Roof-ER long sleeve grey shirt - Size XXL', 'INV-POLO-XXL-' || EXTRACT(EPOCH FROM NOW())::bigint || '1', 'Roof-ER LS Grey Shirt', 2, 2, 'NEW', 'XXL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- ROOF-ER SHIRTS - LONG SLEEVE BLACK
  ('roof-er-ls-black-shirt-m', 'Roof-ER LS Black Shirt (Size M)', 'POLO', 'Roof-ER long sleeve black shirt - Size M', 'INV-POLO-M-' || EXTRACT(EPOCH FROM NOW())::bigint || '2', 'Roof-ER LS Black Shirt', 19, 19, 'NEW', 'M', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ls-black-shirt-l', 'Roof-ER LS Black Shirt (Size L)', 'POLO', 'Roof-ER long sleeve black shirt - Size L', 'INV-POLO-L-' || EXTRACT(EPOCH FROM NOW())::bigint || '2', 'Roof-ER LS Black Shirt', 29, 29, 'NEW', 'L', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ls-black-shirt-xl', 'Roof-ER LS Black Shirt (Size XL)', 'POLO', 'Roof-ER long sleeve black shirt - Size XL', 'INV-POLO-XL-' || EXTRACT(EPOCH FROM NOW())::bigint || '2', 'Roof-ER LS Black Shirt', 19, 19, 'NEW', 'XL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ls-black-shirt-xxl', 'Roof-ER LS Black Shirt (Size XXL)', 'POLO', 'Roof-ER long sleeve black shirt - Size XXL', 'INV-POLO-XXL-' || EXTRACT(EPOCH FROM NOW())::bigint || '2', 'Roof-ER LS Black Shirt', 6, 6, 'NEW', 'XXL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- ROOF-ER SHIRTS - LONG SLEEVE RED
  ('roof-er-ls-red-shirt-m', 'Roof-ER LS Red Shirt (Size M)', 'POLO', 'Roof-ER long sleeve red shirt - Size M', 'INV-POLO-M-' || EXTRACT(EPOCH FROM NOW())::bigint || '3', 'Roof-ER LS Red Shirt', 9, 9, 'NEW', 'M', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ls-red-shirt-l', 'Roof-ER LS Red Shirt (Size L)', 'POLO', 'Roof-ER long sleeve red shirt - Size L', 'INV-POLO-L-' || EXTRACT(EPOCH FROM NOW())::bigint || '3', 'Roof-ER LS Red Shirt', 2, 2, 'NEW', 'L', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ls-red-shirt-xl', 'Roof-ER LS Red Shirt (Size XL)', 'POLO', 'Roof-ER long sleeve red shirt - Size XL', 'INV-POLO-XL-' || EXTRACT(EPOCH FROM NOW())::bigint || '3', 'Roof-ER LS Red Shirt', 4, 4, 'NEW', 'XL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- ROOF-ER SHIRTS - SHORT SLEEVE GREY
  ('roof-er-ss-grey-shirt-s', 'Roof-ER SS Grey Shirt (Size S)', 'POLO', 'Roof-ER short sleeve grey shirt - Size S', 'INV-POLO-S-' || EXTRACT(EPOCH FROM NOW())::bigint || '1', 'Roof-ER SS Grey Shirt', 10, 10, 'NEW', 'S', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ss-grey-shirt-m', 'Roof-ER SS Grey Shirt (Size M)', 'POLO', 'Roof-ER short sleeve grey shirt - Size M', 'INV-POLO-M-' || EXTRACT(EPOCH FROM NOW())::bigint || '4', 'Roof-ER SS Grey Shirt', 9, 9, 'NEW', 'M', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ss-grey-shirt-l', 'Roof-ER SS Grey Shirt (Size L)', 'POLO', 'Roof-ER short sleeve grey shirt - Size L', 'INV-POLO-L-' || EXTRACT(EPOCH FROM NOW())::bigint || '4', 'Roof-ER SS Grey Shirt', 6, 6, 'NEW', 'L', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ss-grey-shirt-xl', 'Roof-ER SS Grey Shirt (Size XL)', 'POLO', 'Roof-ER short sleeve grey shirt - Size XL', 'INV-POLO-XL-' || EXTRACT(EPOCH FROM NOW())::bigint || '4', 'Roof-ER SS Grey Shirt', 25, 25, 'NEW', 'XL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ss-grey-shirt-xxl', 'Roof-ER SS Grey Shirt (Size XXL)', 'POLO', 'Roof-ER short sleeve grey shirt - Size XXL', 'INV-POLO-XXL-' || EXTRACT(EPOCH FROM NOW())::bigint || '3', 'Roof-ER SS Grey Shirt', 9, 9, 'NEW', 'XXL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- ROOF-ER SHIRTS - SHORT SLEEVE BLACK
  ('roof-er-ss-black-shirt-s', 'Roof-ER SS Black Shirt (Size S)', 'POLO', 'Roof-ER short sleeve black shirt - Size S', 'INV-POLO-S-' || EXTRACT(EPOCH FROM NOW())::bigint || '2', 'Roof-ER SS Black Shirt', 10, 10, 'NEW', 'S', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ss-black-shirt-m', 'Roof-ER SS Black Shirt (Size M)', 'POLO', 'Roof-ER short sleeve black shirt - Size M', 'INV-POLO-M-' || EXTRACT(EPOCH FROM NOW())::bigint || '5', 'Roof-ER SS Black Shirt', 1, 1, 'NEW', 'M', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ss-black-shirt-xl', 'Roof-ER SS Black Shirt (Size XL)', 'POLO', 'Roof-ER short sleeve black shirt - Size XL', 'INV-POLO-XL-' || EXTRACT(EPOCH FROM NOW())::bigint || '5', 'Roof-ER SS Black Shirt', 23, 23, 'NEW', 'XL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-ss-black-shirt-xxl', 'Roof-ER SS Black Shirt (Size XXL)', 'POLO', 'Roof-ER short sleeve black shirt - Size XXL', 'INV-POLO-XXL-' || EXTRACT(EPOCH FROM NOW())::bigint || '4', 'Roof-ER SS Black Shirt', 10, 10, 'NEW', 'XXL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- ROOF-ER JACKETS WITH INSERT
  ('roof-er-jacket-insert-black-s', 'Roof-ER Jacket w/ Insert Black (Size S)', 'POLO', 'Roof-ER jacket with insert - black - Size S', 'INV-JACKET-S-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Roof-ER Jacket w/ Insert Black', 6, 6, 'NEW', 'S', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-jacket-insert-black-m', 'Roof-ER Jacket w/ Insert Black (Size M)', 'POLO', 'Roof-ER jacket with insert - black - Size M', 'INV-JACKET-M-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Roof-ER Jacket w/ Insert Black', 5, 5, 'NEW', 'M', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-jacket-insert-black-l', 'Roof-ER Jacket w/ Insert Black (Size L)', 'POLO', 'Roof-ER jacket with insert - black - Size L', 'INV-JACKET-L-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Roof-ER Jacket w/ Insert Black', 6, 6, 'NEW', 'L', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-jacket-insert-black-xl', 'Roof-ER Jacket w/ Insert Black (Size XL)', 'POLO', 'Roof-ER jacket with insert - black - Size XL', 'INV-JACKET-XL-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Roof-ER Jacket w/ Insert Black', 4, 4, 'NEW', 'XL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-jacket-insert-black-xxl', 'Roof-ER Jacket w/ Insert Black (Size XXL)', 'POLO', 'Roof-ER jacket with insert - black - Size XXL', 'INV-JACKET-XXL-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Roof-ER Jacket w/ Insert Black', 4, 4, 'NEW', 'XXL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-jacket-insert-black-3x', 'Roof-ER Jacket w/ Insert Black (Size 3X)', 'POLO', 'Roof-ER jacket with insert - black - Size 3X', 'INV-JACKET-3X-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Roof-ER Jacket w/ Insert Black', 2, 2, 'NEW', '3X', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- GAF LS COTTON GREY SHIRTS
  ('gaf-ls-cotton-grey-shirt-s', 'GAF LS Cotton Grey Shirt (Size S)', 'POLO', 'GAF long sleeve cotton grey shirt - Size S', 'INV-GAF-S-' || EXTRACT(EPOCH FROM NOW())::bigint, 'GAF LS Cotton Grey Shirt', 35, 35, 'NEW', 'S', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('gaf-ls-cotton-grey-shirt-m', 'GAF LS Cotton Grey Shirt (Size M)', 'POLO', 'GAF long sleeve cotton grey shirt - Size M', 'INV-GAF-M-' || EXTRACT(EPOCH FROM NOW())::bigint, 'GAF LS Cotton Grey Shirt', 95, 95, 'NEW', 'M', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('gaf-ls-cotton-grey-shirt-l', 'GAF LS Cotton Grey Shirt (Size L)', 'POLO', 'GAF long sleeve cotton grey shirt - Size L', 'INV-GAF-L-' || EXTRACT(EPOCH FROM NOW())::bigint, 'GAF LS Cotton Grey Shirt', 189, 189, 'NEW', 'L', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('gaf-ls-cotton-grey-shirt-xl', 'GAF LS Cotton Grey Shirt (Size XL)', 'POLO', 'GAF long sleeve cotton grey shirt - Size XL', 'INV-GAF-XL-' || EXTRACT(EPOCH FROM NOW())::bigint, 'GAF LS Cotton Grey Shirt', 79, 79, 'NEW', 'XL', NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- ACCESSORIES
  ('roof-er-caps', 'Roof-ER Caps', 'OTHER', 'Roof-ER branded caps', 'INV-CAPS-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Roof-ER Caps', 28, 28, 'NEW', NULL, NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('roof-er-beanies', 'Roof-ER Beanies', 'OTHER', 'Roof-ER branded beanies', 'INV-BEANIES-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Roof-ER Beanies', 13, 13, 'NEW', NULL, NOW()::text, 0, 'Clothing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- LANYARDS
  ('lanyards', 'Lanyards', 'OTHER', 'Company branded lanyards', 'INV-LANYARDS-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Lanyards', 50, 50, 'NEW', NULL, NOW()::text, 0, 'Office Supplies', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- PLASTIC FOLDERS
  ('plastic-folders', 'Plastic Folders', 'OTHER', 'Plastic document folders', 'INV-FOLDERS-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Plastic Folders', 100, 100, 'NEW', NULL, NOW()::text, 0, 'Office Supplies', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- YARD SIGNS
  ('yard-signs', 'Yard Signs', 'OTHER', 'Company yard signs for job sites', 'INV-SIGNS-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Yard Signs', 25, 25, 'NEW', NULL, NOW()::text, 0, 'Marketing Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- LADDERS
  ('little-giant-ladder-unboxed', 'Little Giant Ladder (Unboxed)', 'LADDER', 'Little Giant multi-position ladder - unboxed', 'INV-LADDER-' || EXTRACT(EPOCH FROM NOW())::bigint || '1', 'Little Giant Ladder', 4, 4, 'GOOD', NULL, NOW()::text, 0, 'Equipment Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('little-giant-ladder-boxed', 'Little Giant Ladder (Boxed)', 'LADDER', 'Little Giant multi-position ladder - new in box', 'INV-LADDER-' || EXTRACT(EPOCH FROM NOW())::bigint || '2', 'Little Giant Ladder', 7, 7, 'NEW', NULL, NOW()::text, 0, 'Equipment Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('werner-ladder', 'Werner Ladder', 'LADDER', 'Werner extension ladder', 'INV-LADDER-' || EXTRACT(EPOCH FROM NOW())::bigint || '3', 'Werner Ladder', 1, 1, 'NEW', NULL, NOW()::text, 0, 'Equipment Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('telescope-ladder', 'Telescope Ladder', 'LADDER', 'Telescoping ladder', 'INV-LADDER-' || EXTRACT(EPOCH FROM NOW())::bigint || '4', 'Telescope Ladder', 3, 3, 'NEW', NULL, NOW()::text, 0, 'Equipment Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- OFFICE SUPPLIES
  ('black-pens', 'Black Pens', 'OTHER', 'Black writing pens', 'INV-PENS-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Black Pens', 50, 50, 'NEW', NULL, NOW()::text, 0, 'Office Supplies', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('silver-markers', 'Silver Markers', 'OTHER', 'Silver permanent markers', 'INV-MARKERS-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Silver Markers', 30, 30, 'NEW', NULL, NOW()::text, 0, 'Office Supplies', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('white-paint-pens', 'White Paint Pens', 'OTHER', 'White acrylic paint pens', 'INV-PAINTPENS-' || EXTRACT(EPOCH FROM NOW())::bigint, 'White Paint Pens', 10, 10, 'NEW', NULL, NOW()::text, 0, 'Office Supplies', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('black-labels-rolls', 'Black Labels (Rolls)', 'OTHER', 'Black label rolls', 'INV-LABELS-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Black Labels', 5, 5, 'NEW', NULL, NOW()::text, 0, 'Office Supplies', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- INSURANCE TEAM SUPPLIES
  ('insurance-folders', 'Insurance Folders', 'OTHER', 'Insurance document folders', 'INV-INSFOLD-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Insurance Folders', 75, 75, 'NEW', NULL, NOW()::text, 0, 'Insurance Team Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('claim-forms-pack', 'Claim Forms Pack', 'OTHER', 'Insurance claim forms pack', 'INV-CLAIMS-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Claim Forms Pack', 20, 20, 'NEW', NULL, NOW()::text, 0, 'Insurance Team Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),

-- EQUIPMENT
  ('ipad-new', 'iPad (New)', 'IPAD', 'New iPad for field use', 'INV-IPAD-' || EXTRACT(EPOCH FROM NOW())::bigint || '1', 'iPad', 8, 8, 'NEW', NULL, NOW()::text, 0, 'Equipment Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('ipad-returned', 'iPad (Returned)', 'IPAD', 'Returned iPad with keyboard', 'INV-IPAD-' || EXTRACT(EPOCH FROM NOW())::bigint || '2', 'iPad', 1, 1, 'GOOD', NULL, NOW()::text, 0, 'Equipment Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('keyboard-case', 'Keyboard Case', 'IPAD', 'iPad keyboard case', 'INV-KEYCASE-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Keyboard Case', 7, 7, 'NEW', NULL, NOW()::text, 0, 'Equipment Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('flashlight-set-new', 'Flashlight Set (New)', 'OTHER', 'New flashlight set', 'INV-FLASH-' || EXTRACT(EPOCH FROM NOW())::bigint || '1', 'Flashlight Set', 9, 9, 'NEW', NULL, NOW()::text, 0, 'Equipment Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('flashlight-set-open-box', 'Flashlight Set (Open Box)', 'OTHER', 'Open box flashlight set', 'INV-FLASH-' || EXTRACT(EPOCH FROM NOW())::bigint || '2', 'Flashlight Set', 1, 1, 'GOOD', NULL, NOW()::text, 0, 'Equipment Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('screen-protector-2pack', 'Screen Protector 2-Pack', 'OTHER', 'Glass screen protector 2-pack', 'INV-SCREEN-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Screen Protector', 12, 12, 'NEW', NULL, NOW()::text, 0, 'Equipment Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text),
  ('charging-cubes', 'Charging Cubes', 'OTHER', 'USB charging cubes', 'INV-CHARGER-' || EXTRACT(EPOCH FROM NOW())::bigint, 'Charging Cubes', 6, 6, 'NEW', NULL, NOW()::text, 0, 'Equipment Storage', 'Updated from inventory list on January 19, 2026', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW()::text, NOW()::text)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  quantity = EXCLUDED.quantity,
  available_quantity = EXCLUDED.available_quantity,
  condition = EXCLUDED.condition,
  is_active = true,
  updated_at = NOW()::text;

-- Step 4: Verify results
SELECT 'INVENTORY UPDATE SUMMARY' AS report;
SELECT category, COUNT(*) as items, SUM(quantity) as total_qty
FROM tool_inventory
WHERE is_active = true
GROUP BY category
ORDER BY category;

SELECT 'Total Active Items: ' || COUNT(*) || ', Total Quantity: ' || SUM(quantity) AS summary
FROM tool_inventory
WHERE is_active = true;
