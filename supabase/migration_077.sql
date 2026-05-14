-- Collections & Collection Scenes system
-- Luxury editorial collections with scene imagery and product tagging

CREATE TABLE IF NOT EXISTS public.collections (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT        NOT NULL UNIQUE,
  name         TEXT        NOT NULL,
  subtitle     TEXT,
  description  TEXT,
  hero_image   TEXT,
  status       TEXT        NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'published')),
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collection_scenes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID        NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  image         TEXT        NOT NULL,
  mobile_image  TEXT,
  caption       TEXT,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collection_scenes_collection_sort
  ON public.collection_scenes(collection_id, sort_order);

CREATE TABLE IF NOT EXISTS public.collection_scene_tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id   UUID        NOT NULL REFERENCES public.collection_scenes(id) ON DELETE CASCADE,
  product_id UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  x          FLOAT       NOT NULL CHECK (x BETWEEN 0 AND 100),
  y          FLOAT       NOT NULL CHECK (y BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collection_scene_tags_scene
  ON public.collection_scene_tags(scene_id);

CREATE TABLE IF NOT EXISTS public.collection_products (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID        NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  product_id    UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, product_id)
);
CREATE INDEX IF NOT EXISTS collection_products_collection_sort
  ON public.collection_products(collection_id, sort_order);

-- RLS
ALTER TABLE public.collections             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_scenes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_scene_tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_products     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_published_collections"
  ON public.collections FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "anon_read_published_scenes"
  ON public.collection_scenes FOR SELECT TO anon
  USING (collection_id IN (
    SELECT id FROM public.collections WHERE status = 'published'
  ));

CREATE POLICY "anon_read_published_scene_tags"
  ON public.collection_scene_tags FOR SELECT TO anon
  USING (scene_id IN (
    SELECT cs.id FROM public.collection_scenes cs
    JOIN public.collections c ON c.id = cs.collection_id
    WHERE c.status = 'published'
  ));

CREATE POLICY "anon_read_published_collection_products"
  ON public.collection_products FOR SELECT TO anon
  USING (collection_id IN (
    SELECT id FROM public.collections WHERE status = 'published'
  ));
