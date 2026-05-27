-- Migration 085: Make order_id nullable + seed hardcoded testimonials
--
-- order_id was NOT NULL which prevented inserting reviews that aren't tied
-- to a specific order (admin testimonials, legacy reviews, etc.).
-- Making it nullable allows standalone reviews while keeping the FK for
-- order-linked reviews.
--
-- Each INSERT tries to look up the real order by order_number.
-- If found → linked; if not → order_id stays NULL. Skips any row whose
-- order_number already has a review.

ALTER TABLE public.reviews ALTER COLUMN order_id DROP NOT NULL;

-- ─── Seed hardcoded testimonials ─────────────────────────────────────────────

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1024' LIMIT 1),
       'BBJ-1024', 'Mina L.', 10,
       'Absolutely beautiful piece. The jade looked even better in person, and I really appreciated how many videos and lighting angles were provided before I purchased. It made me feel much more confident buying online.',
       '2025-08-18', '2025-08-20', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1024');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1041' LIMIT 1),
       'BBJ-1041', 'Sophia T.', 10,
       'Communication was great from start to finish. I had a lot of questions about sizing and was guided through everything very patiently. My bangle fits well and the quality is lovely.',
       '2025-08-29', '2025-09-01', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1041');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1057' LIMIT 1),
       'BBJ-1057', 'Michelle A.', 10,
       'I had looked at jade from a few different sellers before, but I always felt unsure about what I was actually buying. BingBing Jade took the time to explain texture, color, and certification in a way that finally made sense. I felt much more confident choosing my piece.',
       '2025-09-05', '2025-09-07', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1057');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1073' LIMIT 1),
       'BBJ-1073', 'Linh N.', 10,
       'You can tell a lot of care goes into selecting each piece. The color, texture, and glow were all shown honestly, and the jade I received matched the listing very well. I would definitely purchase again.',
       '2025-09-12', '2025-09-14', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1073');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1086' LIMIT 1),
       'BBJ-1086', 'Grace W.', 10,
       'What stood out to me was the education behind the purchase. I had seen similar-looking pieces elsewhere, but I didn''t understand why the prices were different until everything was explained clearly. The transparency made the experience feel very trustworthy.',
       '2025-09-28', '2025-09-30', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1086');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1098' LIMIT 1),
       'BBJ-1098', 'Alyssa R.', 10,
       'I was nervous about buying jade online, but the seller was transparent, detailed, and helpful. The certification gave me peace of mind, and the piece feels very special in hand.',
       '2025-10-22', '2025-10-24', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1098');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1109' LIMIT 1),
       'BBJ-1109', 'Annie N.', 10,
       'I bought jade once before and realized later that I didn''t really understand the certificate or quality details. This time, I felt guided instead of rushed. The seller answered my questions honestly and helped me choose a piece that matched what I actually wanted.',
       '2025-11-19', '2025-11-21', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1109');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1126' LIMIT 1),
       'BBJ-1126', 'Vanessa C.', 10,
       'My bracelet arrived safely and was packaged very securely. The jade has such a soft glow in natural light. It feels elegant, substantial, and clearly high quality.',
       '2025-12-09', '2025-12-11', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1126');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1164' LIMIT 1),
       'BBJ-1164', 'Jenny P.', 10,
       'What I liked most was the honesty. The seller explained how jade can look different in different lighting and took the time to send multiple videos. That transparency meant a lot to me.',
       '2025-12-22', '2025-12-24', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1164');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1187' LIMIT 1),
       'BBJ-1187', 'Thao H.', 10,
       'I requested help sourcing a specific look and was so happy with the result. The piece felt thoughtfully chosen rather than just randomly picked. It really suits my style.',
       '2026-01-11', '2026-01-13', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1187');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1199' LIMIT 1),
       'BBJ-1199', 'Rachel D.', 10,
       'The expedited shipping option was worth it for me. Everything arrived smoothly, and the jade was exactly the kind of refined, natural piece I was hoping for.',
       '2026-01-30', '2026-02-01', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1199');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1208' LIMIT 1),
       'BBJ-1208', 'Emily K.', 10,
       'The bangle is gorgeous and feels even more luxurious in person. I also appreciated how clearly the store policies and expectations were explained before purchase. It made the whole process feel professional.',
       '2026-02-14', '2026-02-16', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1208');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1211' LIMIT 1),
       'BBJ-1211', 'Tina V.', 10,
       'Beautiful natural jade and excellent service. I loved that the seller clearly explained origin, type, and certification instead of being vague. It made me trust the shop a lot more.',
       '2026-03-03', '2026-03-05', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1211');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1236' LIMIT 1),
       'BBJ-1236', 'Candice M.', 10,
       'From the beginning to the end of the process, ordering my Monet jade bangle was a smooth and enjoyable experience. The seller was very communicative throughout every stage, from selecting the raw material to the finished product, and provided lots of updates and photos along the way which made me feel very confident in my purchase.

I''m extremely happy with both the customer service and the bangle itself. The piece is beautiful, unique, and very high quality with an excellent polish and a beautiful colour combination. I am especially glad I went with a raw material purchase as that allowed it to be made in my ideal size and shape, which can be difficult to find.

You can really tell care and attention went into the entire process, even at the end with the beautiful packaging. I''ve already started looking at other pieces from BingBing Jade and would definitely purchase again.',
       '2026-04-08', '2026-04-10', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1236');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1252' LIMIT 1),
       'BBJ-1252', 'Melissa C.', 10,
       '100% would recommend! Bing Bing is very kind and responsive to my inquiries. The item was very well packed (and I''ve never seen such beautiful packaging before!) - you can tell this company really puts a lot of thought and care into their business. The bangle that I purchased was exactly as described/depicted and I love it so much. Thank you for the free gifts, too!',
       '2026-05-05', '2026-05-07', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1252');

INSERT INTO public.reviews (order_id, order_number, customer_name, rating, description, date_purchased, date_rated, is_approved)
SELECT (SELECT id FROM public.orders WHERE order_number = 'BBJ-1256' LIMIT 1),
       'BBJ-1256', 'Gracie W.', 10,
       'Such an incredible bangle! Very reasonable prices for various qualities/sizes and beautiful cared for packaging!',
       '2026-05-09', '2026-05-11', true
WHERE NOT EXISTS (SELECT 1 FROM public.reviews WHERE order_number = 'BBJ-1256');
