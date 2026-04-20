-- Four Seasons House — menu seed from Chowbus / POS screenshots.
-- Pattern: rows live in four_seasons_menu_seed (one row = one dish). apply_four_seasons_menu_from_seed()
-- inserts missing menu_items only. Edit the table, then: SELECT apply_four_seasons_menu_from_seed('https://...');
-- Idempotent: categories via NOT EXISTS on name; items via NOT EXISTS (category_id, name).
-- Verify prices on https://pos.chowbus.com/online-ordering/store/Four-Seasons-House/22737

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Categories (display order)
INSERT INTO public.menu_categories (name, sort_order, created_at, updated_at)
SELECT v.name, v.ord, now(), now()
FROM (
  VALUES
    ('Charcoal Grilled — Chicken'::text, 1),
    ('Charcoal Grilled — Beef', 2),
    ('Charcoal Grilled — Lamb', 3),
    ('Charcoal Grilled — Pork', 4),
    ('Charcoal Grilled — Seafood', 5),
    ('Charcoal Grilled — Vegetable', 6),
    ('Appetizers', 10),
    ('Noodles', 20),
    ('Rice', 30),
    ('American Favorites — Chicken', 40),
    ('American Favorites — Beef', 41),
    ('American Favorites — Seafood', 42),
    ('American Favorites — Vegetable', 43),
    ('Soup', 50),
    ('Specialty — Beef', 60),
    ('Specialty — Chicken', 61),
    ('Specialty — Lamb', 62),
    ('Specialty — Pork', 63),
    ('Specialty — Seafood', 64),
    ('Specialty — Vegetable', 65)
) AS v(name, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.menu_categories mc WHERE mc.name = v.name);

CREATE TABLE IF NOT EXISTS public.four_seasons_menu_seed (
  category_name text NOT NULL,
  name_en text NOT NULL,
  name_zh text,
  description text,
  price_cents integer NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (category_name, name_en)
);

COMMENT ON TABLE public.four_seasons_menu_seed IS
  'Canonical menu seed for Four Seasons House. UPDATE rows then call apply_four_seasons_menu_from_seed() to add any new dishes; existing menu_items rows are not overwritten.';

INSERT INTO public.four_seasons_menu_seed (
  category_name, name_en, name_zh, description, price_cents, sort_order
)
VALUES
    -- Charcoal grilled (Chowbus skewer menu)
    ('Charcoal Grilled — Chicken'::text, 'Chicken (6 skewers)'::text, '鸡肉（6串）'::text, NULL::text, 1085, 1),
    ('Charcoal Grilled — Chicken', 'Chicken cartilage (5 skewers)', '鸡脆骨（5串）', NULL, 1285, 2),
    ('Charcoal Grilled — Chicken', 'Chicken heart (5 skewers)', '鸡心（5串）', NULL, 1285, 3),
    ('Charcoal Grilled — Chicken', 'Chicken stomach (5 skewers)', '鸡胗（5串）', NULL, 1285, 4),
    ('Charcoal Grilled — Chicken', 'Chicken wings (2 skewers)', '鸡中翼（2串）', NULL, 899, 5),
    ('Charcoal Grilled — Chicken', 'Quail eggs', '鹌鹑蛋', NULL, 285, 6),
    ('Charcoal Grilled — Beef', 'Beef (6 skewers)', '牛肉（6串）', NULL, 1285, 1),
    ('Charcoal Grilled — Beef', 'Beef tendon (5 skewers)', '牛肉筋（5串）', NULL, 1285, 2),
    ('Charcoal Grilled — Beef', 'Beef ligament (5 skewers)', '牛板筋（5串）', NULL, 1285, 3),
    ('Charcoal Grilled — Lamb', 'Lamb (6 skewers)', '羊肉（6串）', NULL, 1285, 1),
    ('Charcoal Grilled — Lamb', 'Lamb balls', '羊蛋', NULL, 699, 2),
    ('Charcoal Grilled — Pork', 'Pork belly & enoki (5 skewers)', '五花肉包针菇（5串）', NULL, 1285, 1),
    ('Charcoal Grilled — Pork', 'Pork intestine (3 skewers)', '猪肠（3串）', NULL, 685, 2),
    ('Charcoal Grilled — Pork', 'Chinese hot dog (2 skewers)', '王中王（2串）', NULL, 500, 3),
    ('Charcoal Grilled — Pork', 'Pigs trotters', '猪蹄', NULL, 1299, 4),
    ('Charcoal Grilled — Pork', 'Grilled pork and scallion bun', '烤鲜肉大葱包', NULL, 500, 5),
    ('Charcoal Grilled — Seafood', 'Squid (3 skewers)', '鱿鱼（3串）', NULL, 500, 1),
    ('Charcoal Grilled — Seafood', 'Pollack', '明太鱼', NULL, 1899, 2),
    ('Charcoal Grilled — Seafood', 'Fish tofu (2 skewers)', '鱼豆腐（2串）', NULL, 500, 3),
    ('Charcoal Grilled — Seafood', 'Capelin (3 skewers)', '多春鱼（3串）', NULL, 500, 4),
    ('Charcoal Grilled — Seafood', 'Yellow croaker (2 skewers)', '黄花鱼（2条）', NULL, 500, 5),
    ('Charcoal Grilled — Vegetable', 'Chives', '韭菜', NULL, 500, 1),
    ('Charcoal Grilled — Vegetable', 'Tofu skin (3 skewers)', '豆腐皮（3串）', NULL, 500, 2),
    ('Charcoal Grilled — Vegetable', 'Green hot pepper', '青辣椒', NULL, 500, 3),
    ('Charcoal Grilled — Vegetable', 'Eggplant', '茄子', NULL, 399, 4),
    ('Charcoal Grilled — Vegetable', 'Potato (3 skewers)', '土豆片（3串）', NULL, 500, 5),
    ('Charcoal Grilled — Vegetable', 'Cauliflower (3 skewers)', '花菜（3串）', NULL, 500, 6),
    ('Charcoal Grilled — Vegetable', 'Enoki mushrooms', '金针菇', NULL, 500, 7),
    ('Charcoal Grilled — Vegetable', 'Tofu (3 skewers)', '豆腐（3串）', NULL, 685, 8),
    ('Charcoal Grilled — Vegetable', 'Gluten (3 skewers)', '面筋（3串）', NULL, 785, 9),
    ('Charcoal Grilled — Vegetable', 'Cabbage (3 skewers)', '卷心菜（3串）', NULL, 500, 10),
    ('Charcoal Grilled — Vegetable', 'Sweet bun slices', '甜馒头片', NULL, 200, 11),
    ('Charcoal Grilled — Vegetable', 'Salty bun slices', '咸馒头片', NULL, 200, 12),
    -- Appetizers
    ('Appetizers', 'A1. Vegetarian Spring Rolls 2 Pcs', 'A1. 素春卷2个', NULL, 395, 1),
    ('Appetizers', 'A2. Pork Spring Rolls 2 Pcs', 'A2. 猪肉春卷2个', NULL, 395, 2),
    ('Appetizers', 'A4. Sichuan Cold Noodle', 'A4. 四川凉面', 'Springy wheat noodles served chilled in a bold Sichuan-style sauce with chili oil, garlic, soy, and vinegar.', 899, 3),
    ('Appetizers', 'A6. Cucumber With Pork Ear', 'A6. 凉拌黄瓜耳丝', NULL, 799, 4),
    ('Appetizers', 'A7. Shredded Tofu', 'A7. 凉拌豆腐丝', NULL, 599, 5),
    ('Appetizers', 'A8. Shredded Kelp', 'A8. 凉拌海带丝', NULL, 599, 6),
    ('Appetizers', 'A9. Shredded Potato', 'A9. 炝拌土豆丝', NULL, 599, 7),
    ('Appetizers', 'A10. Chinese Cucumber', 'A10. 拍黄瓜', NULL, 599, 8),
    -- Noodles
    ('Noodles', 'C1. Spicy Beef Noodle Soup', 'C1. 红烧牛肉面', 'Slow-braised beef in a rich soy broth with noodles, bok choy, and scallions.', 1395, 1),
    ('Noodles', 'C2. Chicken Chow Mein', 'C2. 鸡炒面', NULL, 1295, 2),
    ('Noodles', 'C3. Beef Chow Mein', 'C3. 牛肉炒面', NULL, 1450, 3),
    ('Noodles', 'C4. Shrimp Chow Mein', 'C4. 虾仁炒面', NULL, 1450, 4),
    ('Noodles', 'C5. Vegetable Chow Mein', 'C5. 蔬菜炒面', NULL, 1295, 5),
    ('Noodles', 'C6. Combination Chow Mein', 'C6. 什锦炒面', NULL, 1495, 6),
    ('Noodles', 'C7. Sour Cabbage Pork Noodle Soup', 'C7. 酸菜肉丝面', NULL, 1295, 7),
    ('Noodles', 'C8. Tomato Egg Noodle Soup', 'C8. 西红柿鸡蛋面', NULL, 1295, 8),
    -- Rice
    ('Rice', 'C11. Yangzhou Fried Rice', 'C11. 扬州炒饭', 'Classic fried rice with shrimp, egg, carrots, and peas.', 1450, 1),
    ('Rice', 'C12. Minced Beef Fried Rice', 'C12. 生炒牛肉饭', NULL, 1450, 2),
    ('Rice', 'C13. Chicken Fried Rice', 'C13. 鸡炒饭', NULL, 1295, 3),
    ('Rice', 'C14. Beef Fried Rice', 'C14. 牛肉炒饭', NULL, 1450, 4),
    ('Rice', 'C15. Shrimp Fried Rice', 'C15. 虾仁炒饭', NULL, 1450, 5),
    ('Rice', 'C16. Vegetable Fried Rice', 'C16. 蔬菜炒饭', NULL, 1295, 6),
    ('Rice', 'C17. Combination Fried Rice', 'C17. 什锦炒饭', NULL, 1495, 7),
    ('Rice', 'C18. White Rice (One Bowl)', 'C18. 白饭（一碗）', NULL, 200, 8),
    ('Rice', 'C19. Fried Rice (One Bowl)', 'C19. 炒饭（一碗）', NULL, 500, 9),
    -- American favorites
    ('American Favorites — Chicken', 'D1. Vegetable Chicken', 'D1. 蔬菜鸡', NULL, 1495, 1),
    ('American Favorites — Chicken', 'D2. Broccoli Chicken', 'D2. 芥兰鸡', NULL, 1495, 2),
    ('American Favorites — Chicken', 'D3. Kung Pao Chicken', 'D3. 宫保鸡', NULL, 1495, 3),
    ('American Favorites — Chicken', 'D4. Mongolian Chicken', 'D4. 蒙古鸡', NULL, 1495, 4),
    ('American Favorites — Chicken', 'D5. General Tso''s Chicken', 'D5. 左宗鸡', NULL, 1495, 5),
    ('American Favorites — Chicken', 'D6. Orange Chicken', 'D6. 陈皮鸡', NULL, 1495, 6),
    ('American Favorites — Chicken', 'D7. Sesame Chicken', 'D7. 芝麻鸡', NULL, 1495, 7),
    ('American Favorites — Chicken', 'D8. Sichuan Pepper Chicken', 'D8. 椒麻鸡', NULL, 1495, 8),
    ('American Favorites — Chicken', 'D9. Chicken In Spicy Garlic Sauce', 'D9. 鱼香鸡', NULL, 1495, 9),
    ('American Favorites — Beef', 'D11. Broccoli Beef', 'D11. 芥兰牛', NULL, 1295, 1),
    ('American Favorites — Beef', 'D12. Kung Pao Beef', 'D12. 宫保牛', NULL, 1295, 2),
    ('American Favorites — Beef', 'D13. Mongolian Beef', 'D13. 蒙古牛', NULL, 1295, 3),
    ('American Favorites — Beef', 'D14. General Tso''s Beef', 'D14. 左宗牛', NULL, 1295, 4),
    ('American Favorites — Seafood', 'D21. Sichuan Pepper Shrimp', 'D21. 椒麻虾', NULL, 1695, 1),
    ('American Favorites — Seafood', 'D22. Salt And Pepper Shrimp', 'D22. 椒盐虾', NULL, 1695, 2),
    ('American Favorites — Seafood', 'D23. Salt And Pepper Fish', 'D23. 椒盐鱼', NULL, 1895, 3),
    ('American Favorites — Vegetable', 'F87. Sesame Tofu', 'F87. 芝麻豆腐', NULL, 1195, 1),
    ('American Favorites — Vegetable', 'F86. Eggplant In Spicy Garlic Sauce', 'F86. 鱼香茄子', NULL, 1195, 2),
    ('American Favorites — Vegetable', 'F83. Salt And Pepper Tofu', 'F83. 椒盐豆腐', NULL, 1195, 3),
    -- Soup
    ('Soup', 'E1. Egg Drop Soup', 'E1. 蛋花汤', NULL, 295, 1),
    ('Soup', 'E2. Hot And Sour Soup', 'E2. 酸辣汤', NULL, 295, 2),
    -- Specialty
    ('Specialty — Beef', 'F1. Hunan Style Stir-Fried Beef', 'F1. 黄小厨小炒牛肉', 'Thin-sliced beef stir-fried with chilies, garlic, and scallions.', 1895, 1),
    ('Specialty — Beef', 'F2. Stir-Fried Beef With Onions', 'F2. 葱爆肥牛', 'Marbled beef flash-seared with scallions.', 1995, 2),
    ('Specialty — Beef', 'F3. Stewed Beef Brisket', 'F3. 红烧牛腩', NULL, 1895, 3),
    ('Specialty — Beef', 'F4. Dry Pot Beef (Spicy / Mala)', 'F4. 干锅牛肉（香辣/麻辣）', NULL, 2095, 4),
    ('Specialty — Beef', 'F5. Pepper Beef Tenderloin', 'F5. 杭椒牛柳', NULL, 1895, 5),
    ('Specialty — Beef', 'F6. Cumin Beef', 'F6. 孜然牛', 'Beef with cumin, dried chilies, and onions.', 1895, 6),
    ('Specialty — Beef', 'F7. Sliced Fatty Beef W/ Pickled Greens', 'F7. 金汤肥牛', NULL, 2195, 7),
    ('Specialty — Beef', 'F8. Spicy Boiled Beef', 'F8. 水煮牛', 'Beef poached in Sichuan chili broth with vegetables.', 2095, 8),
    ('Specialty — Chicken', 'F11. Dry Pot Chicken (Spicy / Mala)', 'F11. 干锅鸡（香辣/麻辣）', NULL, 1995, 1),
    ('Specialty — Chicken', 'F12. Sichuan Spicy Chicken Gizzards', 'F12. 尖椒鸡珍', NULL, 1795, 2),
    ('Specialty — Chicken', 'F13. Dry-Fried Spicy Chicken', 'F13. 辣子鸡', 'Crispy chicken with dried chiles and Sichuan peppercorns.', 1795, 3),
    ('Specialty — Lamb', 'F21. Cumin Lamb', 'F21. 孜然羊', 'Lamb with cumin, dried chilies, and onions.', 1895, 1),
    ('Specialty — Pork', 'F31. Shredded Pork In Spicy Garlic Sauce', 'F31. 鱼香肉丝', 'Shredded pork with wood ear, bamboo shoots, and bell peppers in yu xiang sauce.', 1595, 1),
    ('Specialty — Pork', 'F32. Smoked Pork Belly With Leek', 'F32. 蒜苗炒腊肉', 'Cured pork belly with leek.', 1895, 2),
    ('Specialty — Pork', 'F33. Dry Pot Pork Intestines (Spicy / Mala)', 'F33. 干锅肥肠（香辣/麻辣）', NULL, 2195, 3),
    ('Specialty — Pork', 'F34. Stir-Fried Pork Belly', 'F34. 熊大小炒肉', NULL, 1795, 4),
    ('Specialty — Pork', 'F35. Dry-Fried Pork Intestines', 'F35. 干煸肥肠', NULL, 1895, 5),
    ('Specialty — Pork', 'F37. Mapo Tofu With Minced Pork', 'F37. 麻婆豆腐（肉）', 'Soft tofu in chili-bean sauce with minced pork.', 1595, 6),
    ('Specialty — Pork', 'F38. Sichuan Pork Belly', 'F38. 回锅肉', 'Twice-cooked pork belly with leeks and fermented broad bean paste.', 1695, 7),
    ('Specialty — Pork', 'F39. Mala Pork Blood And Intestine', 'F39. 毛血旺', NULL, 3095, 8),
    ('Specialty — Pork', 'F40. Stir-Fried Pork Strips With Smoked Tofu', 'F40. 香干肉丝', 'Pork with smoked tofu and vegetables.', 1595, 9),
    ('Specialty — Pork', 'F41. Chinese Sausage With Cabbage', 'F41. 腊肉炒包菜', NULL, 1895, 10),
    ('Specialty — Seafood', 'F51. Fish With Pickled Greens', 'F51. 酸菜鱼', 'Fish in broth with pickled mustard greens and Sichuan pepper.', 2195, 1),
    ('Specialty — Seafood', 'F52. Mala Combination', 'F52. 麻辣香锅', 'Stir-fried medley with Sichuan peppercorns and spices.', 2695, 2),
    ('Specialty — Seafood', 'F53. Spicy Boiled Fish', 'F53. 沸腾水煮鱼', 'Fish poached in spicy chili broth.', 2195, 3),
    ('Specialty — Seafood', 'F54. Dry Pot Shrimps (Spicy / Mala)', 'F54. 干锅虾（香辣/麻辣）', NULL, 2295, 4),
    ('Specialty — Seafood', 'F55. Fish Fillets In Rice Wine Sauce', 'F55. 酒糟鱼片', NULL, 1595, 5),
    ('Specialty — Seafood', 'F56. Dry Pot Fish Fillets (Spicy / Mala)', 'F56. 干锅鱼片（香辣/麻辣）', NULL, 2095, 6),
    ('Specialty — Seafood', 'F57. Hot And Spicy Fish Fillets', 'F57. 香辣鱼片', NULL, 1895, 7),
    ('Specialty — Seafood', 'F58. Peppercorn Fish And Lamb Pot', 'F58. 藤椒鱼羊锅', NULL, 2695, 8),
    ('Specialty — Seafood', 'F59. Charcoal Grilled Striped Bass', 'F59. 江边炭烤鱼', 'Charcoal grilled whole fish.', 3995, 9),
    ('Specialty — Seafood', 'F61. Scrambled Eggs With Shrimp', 'F61. 滑蛋虾仁', NULL, 1595, 10),
    ('Specialty — Vegetable', 'F42. Dry Pot Cauliflower (Spicy / Mala)', 'F42. 干锅花菜（香辣/麻辣）', NULL, 1995, 1),
    ('Specialty — Vegetable', 'F71. Stir-Fried Chinese Napa Cabbage', 'F71. 炝炒大白菜', NULL, 1295, 2),
    ('Specialty — Vegetable', 'F72. Stir-Fried Bok Choy With Garlic', 'F72. 蒜蓉炒青江菜', 'Bok choy stir-fried with garlic.', 1295, 3),
    ('Specialty — Vegetable', 'F73. Spicy Cabbage', 'F73. 焙炒卷心菜', NULL, 1295, 4),
    ('Specialty — Vegetable', 'F74. Stir-Fried Wood Mushroom With Yam', 'F74. 木耳炒山药', 'Wood ear mushrooms with Chinese yam.', 1395, 5),
    ('Specialty — Vegetable', 'F75. Shredded Potato In Sour Sauce', 'F75. 醋溜土豆丝', NULL, 1195, 6),
    ('Specialty — Vegetable', 'F76. Homestyle Tofu', 'F76. 家常豆腐', 'Pan-fried tofu with vegetables in savory sauce.', 1395, 7)
ON CONFLICT (category_name, name_en) DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_four_seasons_menu_from_seed(
  p_image_url text DEFAULT 'https://placehold.co/480x320/e2e8f0/334155?text=Four+Seasons+House'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO public.menu_items (
    category_id,
    name,
    name_chinese,
    description,
    price_cents,
    image_url,
    is_available,
    sort_order,
    created_at,
    updated_at
  )
  SELECT
    c.id,
    s.name_en,
    s.name_zh,
    s.description,
    s.price_cents,
    p_image_url,
    true,
    s.sort_order,
    now(),
    now()
  FROM public.four_seasons_menu_seed s
  JOIN public.menu_categories c ON c.name = s.category_name
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.category_id = c.id AND mi.name = s.name_en
  );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

COMMENT ON FUNCTION public.apply_four_seasons_menu_from_seed(text) IS
  'Inserts menu_items for seed rows not yet present (same category + English name). Returns insert count. Optional p_image_url for new rows.';

SELECT public.apply_four_seasons_menu_from_seed();

-- After editing four_seasons_menu_seed: re-INSERT new rows with ON CONFLICT DO NOTHING, then
-- SELECT apply_four_seasons_menu_from_seed();
