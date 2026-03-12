-- Align notifications schema + RPCs with frontend expectations
-- Goal: eliminate runtime PostgREST/RPC errors for notifications UI.

-- ----------------------------------------------------------------------------
-- Table: notifications
-- ----------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link TEXT,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS related_entity_id TEXT;

-- Keep legacy action_url compatible.
UPDATE public.notifications
SET link = action_url
WHERE link IS NULL AND action_url IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notifications_sync_link_action_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.link IS NOT NULL AND (NEW.action_url IS NULL OR NEW.action_url = '') THEN
    NEW.action_url := NEW.link;
  ELSIF NEW.link IS NULL AND NEW.action_url IS NOT NULL AND NEW.action_url <> '' THEN
    NEW.link := NEW.action_url;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_sync_link_action_url ON public.notifications;
CREATE TRIGGER trg_notifications_sync_link_action_url
BEFORE INSERT OR UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.notifications_sync_link_action_url();

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_archived ON public.notifications(user_id) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON public.notifications(user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- Table: notification_preferences
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  category_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT '07:00',
  digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  digest_frequency TEXT NOT NULL DEFAULT 'daily',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- RPC: mark_notification_read
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE,
      read_at = COALESCE(read_at, now()),
      updated_at = now()
  WHERE id = p_notification_id
    AND user_id = p_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: archive_notification
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_notification(
  p_notification_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.notifications
  SET is_archived = TRUE,
      updated_at = now()
  WHERE id = p_notification_id
    AND user_id = p_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: get_or_create_notification_preferences
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_notification_preferences()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_row public.notification_preferences%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.notification_preferences(user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row
  FROM public.notification_preferences
  WHERE user_id = v_user_id;

  RETURN to_jsonb(v_row);
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: batch_create_notifications
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.batch_create_notifications(
  p_user_ids UUID[],
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_type TEXT DEFAULT 'info',
  p_priority TEXT DEFAULT 'normal',
  p_category TEXT DEFAULT 'general'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  INSERT INTO public.notifications(user_id, title, message, link, action_url, type, priority, category, is_read, created_at, updated_at)
  SELECT u, p_title, p_message, p_link, p_link, p_type, p_priority, p_category, FALSE, now(), now()
  FROM unnest(p_user_ids) AS u;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: create_notification_from_template (minimal implementation)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification_from_template(
  p_template_code TEXT,
  p_user_id UUID,
  p_variables JSONB DEFAULT '{}'::jsonb,
  p_sender_id UUID DEFAULT NULL,
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_title TEXT;
  v_message TEXT;
BEGIN
  v_id := gen_random_uuid();
  v_title := 'Notification: ' || COALESCE(p_template_code, 'template');
  v_message := COALESCE(p_variables->>'message', 'You have a new notification.');

  INSERT INTO public.notifications(
    id, user_id, title, message, type, priority, category, link, action_url,
    data, sender_id, related_entity_type, related_entity_id,
    is_read, is_archived, created_at, updated_at
  ) VALUES (
    v_id, p_user_id, v_title, v_message, 'info', 'normal', 'general', NULL, NULL,
    jsonb_build_object('template_code', p_template_code, 'variables', p_variables),
    p_sender_id, p_related_entity_type, p_related_entity_id,
    FALSE, FALSE, now(), now()
  );

  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC: cleanup_old_notifications
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_archived INT := 0;
  v_deleted INT := 0;
BEGIN
  UPDATE public.notifications
  SET is_archived = TRUE, updated_at = now()
  WHERE is_archived = FALSE
    AND is_read = TRUE
    AND created_at < now() - INTERVAL '30 days';

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  DELETE FROM public.notifications
  WHERE created_at < now() - INTERVAL '180 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'archived_count', v_archived,
    'deleted_count', v_deleted
  );
END;
$$;

-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload schema';

