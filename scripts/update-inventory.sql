-- Mark existing inventory as inactive
UPDATE tool_inventory SET is_active = false;

-- Insert new inventory items
-- CLOTHING - SHIRTS
INSERT INTO tool_inventory (id, name, category, description, serial_number, model, quantity, available_quantity, condition, purchase_date, purchase_price, location, notes, is_active, created_by, created_at, updated_at) VALUES
('grey-polo-m', 'Grey Polo (Size M)', 'POLO', 'Grey polo shirt - Size M', 'CLOTHING-M-001', 'Grey Polo', 22, 22, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('grey-polo-l', 'Grey Polo (Size L)', 'POLO', 'Grey polo shirt - Size L', 'CLOTHING-L-001', 'Grey Polo', 16, 16, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('grey-polo-xl', 'Grey Polo (Size XL)', 'POLO', 'Grey polo shirt - Size XL', 'CLOTHING-XL-001', 'Grey Polo', 22, 22, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('grey-polo-xxl', 'Grey Polo (Size XXL)', 'POLO', 'Grey polo shirt - Size XXL', 'CLOTHING-XXL-001', 'Grey Polo', 23, 23, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('grey-polo-3x', 'Grey Polo (Size 3X)', 'POLO', 'Grey polo shirt - Size 3X', 'CLOTHING-3X-001', 'Grey Polo', 15, 15, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('black-polo-m', 'Black Polo (Size M)', 'POLO', 'Black polo shirt - Size M', 'CLOTHING-M-002', 'Black Polo', 21, 21, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('black-polo-l', 'Black Polo (Size L)', 'POLO', 'Black polo shirt - Size L', 'CLOTHING-L-002', 'Black Polo', 14, 14, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('black-polo-xl', 'Black Polo (Size XL)', 'POLO', 'Black polo shirt - Size XL', 'CLOTHING-XL-002', 'Black Polo', 19, 19, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('black-polo-xxl', 'Black Polo (Size XXL)', 'POLO', 'Black polo shirt - Size XXL', 'CLOTHING-XXL-002', 'Black Polo', 21, 21, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('black-polo-3x', 'Black Polo (Size 3X)', 'POLO', 'Black polo shirt - Size 3X', 'CLOTHING-3X-002', 'Black Polo', 15, 15, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),

-- EQUIPMENT
('ipad-new', 'iPad only (New)', 'IPAD', 'New iPad without accessories', 'IPAD-001', 'iPad', 8, 8, 'NEW', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('ipad-returned', 'Returned iPad (w/ Keyboard)', 'IPAD', 'Returned iPad with keyboard', 'IPAD-002', 'iPad', 1, 1, 'GOOD', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('keyboard-case', 'Keyboard Case (w/o iPad)', 'IPAD', 'Keyboard case without iPad', 'IPAD-003', 'Keyboard Case', 7, 7, 'NEW', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),

-- OTHER EQUIPMENT
('flashlight-set', 'Flashlight Set', 'OTHER', 'New flashlight set', 'MISC-001', 'Flashlight', 9, 9, 'NEW', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('flashlight-open', 'Flashlight Set (Open Box)', 'OTHER', 'Open box flashlight set', 'MISC-002', 'Flashlight', 1, 1, 'GOOD', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('flashlight-old', 'Flashlight Old', 'OTHER', 'Old model flashlight', 'MISC-003', 'Flashlight', 1, 1, 'FAIR', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('screen-protector-2pk', 'Glass Screen Protector (2 pack)', 'OTHER', '2-pack glass screen protectors', 'MISC-004', 'Screen Protector', 12, 12, 'NEW', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('screen-protector-1pk', 'Glass Screen Protector (Single)', 'OTHER', 'Single glass screen protector', 'MISC-005', 'Screen Protector', 1, 1, 'NEW', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('charging-cubes', 'Charging Cubes', 'OTHER', 'USB charging cubes', 'MISC-006', 'Charger', 6, 6, 'NEW', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('ladder-utility', 'Ladder', 'LADDER', 'Work ladder', 'LADDER-001', 'Ladder', 1, 1, 'GOOD', NOW(), 0, 'Utility Closet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),

-- OFFICE SUPPLIES
('black-labels', 'Black Labels (Rolls)', 'OTHER', 'Black label rolls', 'OFFICE-001', 'Labels', 3, 3, 'NEW', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('silver-markers', 'Silver Markers', 'OTHER', 'Silver permanent markers', 'OFFICE-002', 'Markers', 32, 32, 'NEW', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('white-paint-pens', 'White Acrylic Paint Pens', 'OTHER', 'White acrylic paint pens', 'OFFICE-003', 'Paint Pens', 5, 5, 'NEW', NOW(), 0, 'Middle Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('black-pens', 'Black Pens', 'OTHER', 'Black writing pens', 'OFFICE-004', 'Pens', 24, 24, 'NEW', NOW(), 0, 'First Black Cabinet', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),

-- ACCESSORIES
('beanies', 'Beanies', 'OTHER', 'Winter beanies', 'ACC-001', 'Beanies', 9, 9, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW()),
('baseball-caps', 'Baseball Caps', 'OTHER', 'Baseball caps', 'ACC-002', 'Caps', 2, 2, 'NEW', NOW(), 0, 'Clothing Storage', 'Updated from inventory list', true, 'fc51fba0-9f18-4db4-8c6a-a8aba2a5fd37', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  quantity = EXCLUDED.quantity,
  available_quantity = EXCLUDED.available_quantity,
  location = EXCLUDED.location,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
