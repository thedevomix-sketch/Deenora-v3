-- Drop the existing function to avoid conflicts
DROP FUNCTION IF EXISTS public.get_monthly_dues_report(uuid, uuid, text);

-- Create the improved function with correct parameters and return types
CREATE OR REPLACE FUNCTION public.get_monthly_dues_report(
    p_institution_id UUID,
    p_class_id UUID DEFAULT NULL,
    p_month TEXT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    roll INTEGER,
    class_id UUID,
    guardian_phone TEXT,
    total_payable NUMERIC,
    total_paid NUMERIC,
    balance_due NUMERIC,
    status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH class_fees AS (
        -- Calculate total fixed fees for each class
        SELECT 
            fs.class_id, 
            COALESCE(SUM(fs.amount), 0) as total_fixed_fee
        FROM public.fee_structures fs
        WHERE fs.institution_id = p_institution_id
        GROUP BY fs.class_id
    ),
    student_payments AS (
        -- Calculate total payments for each student for the specific month
        SELECT 
            f.student_id, 
            COALESCE(SUM(f.amount_paid), 0) as total_collected
        FROM public.fees f
        WHERE f.institution_id = p_institution_id AND f.month = p_month
        GROUP BY f.student_id
    )
    SELECT 
        s.id as student_id,
        s.student_name,
        s.roll,
        s.class_id,
        s.guardian_phone,
        COALESCE(cf.total_fixed_fee, 0)::NUMERIC as total_payable,
        COALESCE(sp.total_collected, 0)::NUMERIC as total_paid,
        (COALESCE(cf.total_fixed_fee, 0) - COALESCE(sp.total_collected, 0))::NUMERIC as balance_due,
        CASE 
            WHEN COALESCE(cf.total_fixed_fee, 0) <= 0 THEN 'no_fee'
            WHEN COALESCE(sp.total_collected, 0) >= COALESCE(cf.total_fixed_fee, 0) THEN 'paid'
            WHEN COALESCE(sp.total_collected, 0) > 0 THEN 'partial'
            ELSE 'unpaid'
        END as status
    FROM public.students s
    LEFT JOIN class_fees cf ON s.class_id = cf.class_id
    LEFT JOIN student_payments sp ON s.id = sp.student_id
    WHERE s.institution_id = p_institution_id
    AND (p_class_id IS NULL OR s.class_id = p_class_id)
    ORDER BY s.roll ASC NULLS LAST;
END;
$$;

-- Force schema cache reload
NOTIFY pgrst, 'reload config';
