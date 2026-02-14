create table if not exists assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  title text not null default 'New conversation',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_assistant_conversations_project_updated
  on assistant_conversations (project_name, updated_at desc);

create table if not exists assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references assistant_conversations(id) on delete cascade,
  role text not null check (role in ('system', 'assistant', 'user', 'tool')),
  content text not null,
  message_type text not null default 'text',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_assistant_messages_conversation_created
  on assistant_messages (conversation_id, created_at asc);

create or replace function set_assistant_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_assistant_conversations_updated_at on assistant_conversations;
create trigger trg_assistant_conversations_updated_at
before update on assistant_conversations
for each row
execute function set_assistant_conversation_updated_at();

create or replace function touch_assistant_conversation_on_message()
returns trigger
language plpgsql
as $$
begin
  update assistant_conversations
  set updated_at = greatest(updated_at, new.created_at)
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_assistant_messages_touch_conversation on assistant_messages;
create trigger trg_assistant_messages_touch_conversation
after insert on assistant_messages
for each row
execute function touch_assistant_conversation_on_message();
