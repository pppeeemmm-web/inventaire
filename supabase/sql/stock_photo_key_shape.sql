-- Équipement photo key shape (Pem « go for all the rest », 2026-11-28; flow review of 8f134cb).
-- A Stock item's photo_key is only ever one the photo door made for that item (stock/S_{id}_{rand8}_{hash8}.avif),
-- or null: a direct call to save_stock_item (or any writer) can no longer point an item at another record's image,
-- which the next « 📷 Photo » would have sent to the recycle bin. The app checks the same (saveStockItem,
-- setStockItemPhoto); the database now holds it (principle 1). Live 2026-11-28: 235 items, 0 photos, 0 off shape.
alter table public.stock_item drop constraint if exists stock_item_photo_key_shape_ck;
alter table public.stock_item add constraint stock_item_photo_key_shape_ck
  check (photo_key is null or photo_key ~ ('^stock/S_' || id || '_[0-9a-f]{8}_[0-9a-f]{8}\.avif$'));
