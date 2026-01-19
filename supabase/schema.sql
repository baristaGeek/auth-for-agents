-- Auth-for-Agents Database Schema
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents (AI agents that can request access)
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

-- Service providers (Gmail, Slack, etc.)
CREATE TABLE IF NOT EXISTS public.service_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  oauth_client_id TEXT NOT NULL,
  oauth_client_secret_encrypted TEXT NOT NULL,
  oauth_authorize_url TEXT NOT NULL,
  oauth_token_url TEXT NOT NULL,
  oauth_scopes TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service connections (OAuth grants between agents and services)
CREATE TABLE IF NOT EXISTS public.service_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  service_provider_id TEXT REFERENCES public.service_providers(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- OAuth tokens
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL,

  -- Metadata from OAuth provider
  provider_user_id TEXT,
  provider_email TEXT,
  provider_metadata JSONB DEFAULT '{}',

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  UNIQUE(agent_id, service_provider_id, user_id)
);

-- Connection requests (temporary records for OAuth flow)
CREATE TABLE IF NOT EXISTS public.connection_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  service_provider_id TEXT REFERENCES public.service_providers(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scopes TEXT[] NOT NULL,
  state TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'rejected')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Approval rules (Zapier-like rules for human-in-the-loop)
CREATE TABLE IF NOT EXISTS public.approval_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,

  -- Conditions (when to trigger approval)
  conditions JSONB NOT NULL,

  -- Action settings
  require_approval BOOLEAN DEFAULT true,
  auto_approve_after_hours INTEGER,
  notify_channels JSONB DEFAULT '[]',
  approvers UUID[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending approvals (queue of actions awaiting human approval)
CREATE TABLE IF NOT EXISTS public.pending_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  service_connection_id UUID REFERENCES public.service_connections(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.approval_rules(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Action details
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  action_summary TEXT NOT NULL,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- Resolution
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_comment TEXT,
  expires_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval history (for auditing)
CREATE TABLE IF NOT EXISTS public.approval_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  approval_id UUID REFERENCES public.pending_approvals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  comment TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents (for RAG)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Document metadata
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_size INTEGER,
  file_type TEXT,
  mime_type TEXT,

  -- Content and embeddings
  content_text TEXT,
  content_chunks JSONB,
  embeddings_generated BOOLEAN DEFAULT false,

  -- Categorization
  tags TEXT[] DEFAULT '{}',
  category TEXT,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'processing', 'archived', 'deleted')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

-- Document permissions (fine-grained access control)
CREATE TABLE IF NOT EXISTS public.document_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  granted_by UUID REFERENCES auth.users(id) NOT NULL,

  -- Permission levels
  access_level TEXT DEFAULT 'read' CHECK (access_level IN ('read', 'write', 'admin')),

  -- Fine-grained controls
  can_query BOOLEAN DEFAULT true,
  can_download BOOLEAN DEFAULT false,
  can_modify BOOLEAN DEFAULT false,

  -- Access restrictions
  allowed_sections INTEGER[],
  restricted_keywords TEXT[],

  -- Validity period
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  granted_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  UNIQUE(document_id, agent_id)
);

-- Document access logs (audit trail)
CREATE TABLE IF NOT EXISTS public.document_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,

  access_type TEXT NOT NULL,
  query_text TEXT,
  chunks_accessed INTEGER[],

  -- Result metadata
  result_summary JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API usage logs (rate limiting and billing)
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,

  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,

  -- For rate limiting
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_owner_id ON public.agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_api_key_prefix ON public.agents(api_key_prefix);
CREATE INDEX IF NOT EXISTS idx_service_connections_agent_id ON public.service_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_service_connections_user_id ON public.service_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_agent_id ON public.connection_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status_expires ON public.connection_requests(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_agent_id ON public.pending_approvals(agent_id);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_owner_status ON public.pending_approvals(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_expires_at ON public.pending_approvals(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approval_rules_owner_active ON public.approval_rules(owner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_agent_id ON public.document_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_document_id ON public.document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_agent_id ON public.document_access_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_document_access_logs_document_id ON public.document_access_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_agent_created ON public.api_usage_logs(agent_id, created_at);

-- Row Level Security (RLS) policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for agents
DROP POLICY IF EXISTS "Users can view own agents" ON public.agents;
CREATE POLICY "Users can view own agents" ON public.agents FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own agents" ON public.agents;
CREATE POLICY "Users can insert own agents" ON public.agents FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own agents" ON public.agents;
CREATE POLICY "Users can update own agents" ON public.agents FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own agents" ON public.agents;
CREATE POLICY "Users can delete own agents" ON public.agents FOR DELETE USING (auth.uid() = owner_id);

-- RLS Policies for service_connections
DROP POLICY IF EXISTS "Users can view own connections" ON public.service_connections;
CREATE POLICY "Users can view own connections" ON public.service_connections FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own connections" ON public.service_connections;
CREATE POLICY "Users can delete own connections" ON public.service_connections FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for connection_requests
DROP POLICY IF EXISTS "Users can view own connection requests" ON public.connection_requests;
CREATE POLICY "Users can view own connection requests" ON public.connection_requests FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own connection requests" ON public.connection_requests;
CREATE POLICY "Users can manage own connection requests" ON public.connection_requests FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for approval_rules
DROP POLICY IF EXISTS "Users can view own rules" ON public.approval_rules;
CREATE POLICY "Users can view own rules" ON public.approval_rules FOR ALL USING (auth.uid() = owner_id);

-- RLS Policies for pending_approvals
DROP POLICY IF EXISTS "Users can view own approvals" ON public.pending_approvals;
CREATE POLICY "Users can view own approvals" ON public.pending_approvals FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own approvals" ON public.pending_approvals;
CREATE POLICY "Users can update own approvals" ON public.pending_approvals FOR UPDATE USING (auth.uid() = owner_id);

-- RLS Policies for documents
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;
CREATE POLICY "Users can manage own documents" ON public.documents FOR ALL USING (auth.uid() = owner_id);

-- RLS Policies for document_permissions
DROP POLICY IF EXISTS "Users can manage own doc permissions" ON public.document_permissions;
CREATE POLICY "Users can manage own doc permissions" ON public.document_permissions FOR ALL USING (auth.uid() = granted_by);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON public.user_profiles;
CREATE TRIGGER set_updated_at_user_profiles BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_agents ON public.agents;
CREATE TRIGGER set_updated_at_agents BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_approval_rules ON public.approval_rules;
CREATE TRIGGER set_updated_at_approval_rules BEFORE UPDATE ON public.approval_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_pending_approvals ON public.pending_approvals;
CREATE TRIGGER set_updated_at_pending_approvals BEFORE UPDATE ON public.pending_approvals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_documents ON public.documents;
CREATE TRIGGER set_updated_at_documents BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert Gmail as default service provider (you'll need to add your real credentials)
INSERT INTO public.service_providers (id, name, description, oauth_client_id, oauth_client_secret_encrypted, oauth_authorize_url, oauth_token_url, oauth_scopes)
VALUES (
  'gmail',
  'Gmail',
  'Google Gmail API access',
  'YOUR_GOOGLE_CLIENT_ID',
  'YOUR_ENCRYPTED_GOOGLE_CLIENT_SECRET',
  'https://accounts.google.com/o/oauth2/v2/auth',
  'https://oauth2.googleapis.com/token',
  ARRAY['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify']
)
ON CONFLICT (id) DO NOTHING;
