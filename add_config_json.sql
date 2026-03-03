-- Add config_json column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'config_json') THEN
        ALTER TABLE public.institutions ADD COLUMN config_json JSONB DEFAULT '{
            "modules": {
              "attendance": true,
              "fees": true,
              "results": true,
              "admit_card": true,
              "seat_plan": true,
              "accounting": true
            },
            "result_system": "grading",
            "attendance_type": "daily",
            "fee_structure": "monthly",
            "ui_mode": "madrasah"
          }'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'theme') THEN
        ALTER TABLE public.institutions ADD COLUMN theme TEXT DEFAULT 'default';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'status') THEN
        ALTER TABLE public.institutions ADD COLUMN status TEXT DEFAULT 'active';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'subscription_end') THEN
        ALTER TABLE public.institutions ADD COLUMN subscription_end DATE;
    END IF;
END $$;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
