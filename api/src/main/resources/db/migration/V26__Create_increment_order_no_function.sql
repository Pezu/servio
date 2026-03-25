-- Create function to atomically increment and return order number
CREATE OR REPLACE FUNCTION increment_order_no(event_id UUID)
RETURNS INTEGER AS $$
DECLARE
    new_order_no INTEGER;
BEGIN
    UPDATE events
    SET last_order_no = last_order_no + 1
    WHERE id = event_id
    RETURNING last_order_no INTO new_order_no;

    RETURN new_order_no;
END;
$$ LANGUAGE plpgsql;
