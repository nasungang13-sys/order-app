INSERT INTO menus (name, description, price, image_url, stock_quantity)
VALUES
  ('아메리카노 (ICE)', '산뜻하고 깔끔한 밸런스', 4000, NULL, 10),
  ('아메리카노 (HOT)', '따뜻하게 즐기는 깊은 풍미', 4000, NULL, 3),
  ('카페라떼', '부드러운 우유와 에스프레소', 5000, NULL, 0)
ON CONFLICT (name) DO NOTHING;

INSERT INTO options (menu_id, name, price)
SELECT menu.id, option_data.name, option_data.price
FROM menus AS menu
CROSS JOIN (
  VALUES ('샷 추가', 500), ('시럽 추가', 0)
) AS option_data(name, price)
WHERE menu.name IN ('아메리카노 (ICE)', '아메리카노 (HOT)', '카페라떼')
ON CONFLICT (menu_id, name) DO NOTHING;
