-- Ice Cube POS & Inventory Tracker
-- Supabase Schema Configuration

-- Create settings table
CREATE TABLE public.settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    pickup_price numeric NOT NULL DEFAULT 8,
    delivery_price numeric NOT NULL DEFAULT 10,
    cost_per_kg numeric NOT NULL DEFAULT 0,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert the single default row for settings
INSERT INTO public.settings (pickup_price, delivery_price, cost_per_kg) VALUES (8, 10, 0);

-- Create sales_entries table
CREATE TABLE public.sales_entries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    kg numeric NOT NULL,
    sale_type text NOT NULL CHECK (sale_type IN ('pickup', 'delivery')),
    price_per_kg numeric NOT NULL,
    cost_per_kg numeric NOT NULL,
    revenue numeric NOT NULL
);

-- Create production_entries table
CREATE TABLE public.production_entries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    kg_produced numeric NOT NULL
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations for anonymous users 
-- (Since this is a single-owner app with no auth for now, we just open it up to the API key)
CREATE POLICY "Allow anon all on settings" ON public.settings FOR ALL USING (true);
CREATE POLICY "Allow anon all on sales_entries" ON public.sales_entries FOR ALL USING (true);
CREATE POLICY "Allow anon all on production_entries" ON public.production_entries FOR ALL USING (true);
